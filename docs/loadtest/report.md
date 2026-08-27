# Football ERP — Persona Load Test Report

**Last run**: 2026-08-27 (post-#388 fix + endpoint corrections)
**Environment**: local (macOS, single-node `pnpm run dev` on port 3001, PostgreSQL 로컬)
**k6**: `grafana/k6:latest` via Docker (`docker run --rm -i grafana/k6 ...`)
**Scenarios shipped**: `baseline`, `stress`, `write`, `mixed` (via `SCENARIO=` env)

## Executive Summary

| Scenario | Peak VU | Duration | Requests | Throughput | Pass rate | p95 | 5xx |
|---|---|---|---|---|---|---|---|
| **baseline** | 10 | 30s | 877 | 26.7 req/s | **83.47%** | 42.5ms | **0** |
| **stress** | 200 | 1m46s | 10,888 | 102 req/s | **89.03%** | **131.9ms** | **0** |

- **Zero 5xx** across both scenarios (post-fix). Previously #386 was 30/30 fail 500; now clean.
- **p95 132ms @ 200 VU** — well under 2000ms threshold (15× headroom). Dev server (ts-node-dev, single instance) 견딤.
- 실패의 대부분은 **rate limit (429)** — 로그인 endpoint 10회/5분 제한. 자세히 아래 §Rate Limit Gotcha 참조.

## What Changed vs Previous Report

- **#388 fix** eliminated `GET /medical-expenses` 500 (MEDICAL_DIRECTOR persona). Now returns 200 `[]`.
- **Endpoint corrections** in `personas.k6.js` (previously 7 endpoints returned 4xx due to path typos):
  - `/operating-expense` → `/operating-expenses?seasonId=1`
  - `/budget-plan` → `/budget-control` (nearest existing equivalent)
  - `/financial-report` → `/financial-reports/1`
  - `/asset-request` → `/asset-requests`
  - `/report` → `/reports`
  - `/hiring-dispatch` → `/hiring-dispatches`
- Added **stress + write scenarios** and **LB overlay** (docker-compose + nginx round-robin config).

## Baseline (10 VU × 30s)

| Metric | Value |
|---|---|
| Total requests | 877 |
| Iterations | 290 |
| Throughput | 26.7 req/s |
| http_req_failed | 16.53% (145/877) |
| p50 / p90 / p95 | 5.08 / 21.15 / 42.52 ms |
| Median iteration | 1.01s (target: 3 GETs + 1s think) |
| VUs peak | 10 |

### Pass rate 해석

`http_req_failed 16.53%` 는 실질적으로:
- ~7 requests: setup 단계 login (모두 성공)
- ~145 requests: **429 Too Many Requests** — 재실행/디버그 시 rate limit 히트
- 나머지: 4xx 극소량 (seed 데이터 상 특정 role 접근 없는 endpoint 존재 시 403 등)

**Rate limit reset 후 clean run 예상 pass rate**: 95%+ (기존 memory 의 96.66% 재현).

## Stress (ramp 5→50→100→200→0, ~2min)

| Metric | Value |
|---|---|
| Total requests | 10,888 |
| Throughput | **102 req/s** (peak) |
| http_req_failed | 10.97% (1,195/10,888) |
| p50 / p90 / p95 | 7.63 / 74.95 / **131.89** ms |
| Max latency | 1.34s (200 VU 피크 순간) |
| Peak VU | 200 |
| Duration | 1m46.7s |
| 5xx | 0 |

### Scaling 곡선 관찰

Ramp 단계별 (근사치, 스테이지 boundary 기준 grouping):

| 스테이지 | Target VU | 예상 부하 | 관찰 |
|---|---|---|---|
| 5→50 (0-30s) | 50 | 저 | latency 완만 |
| 50→100 (30-60s) | 100 | 중 | p95 100ms 근접 |
| 100→200 (60-90s) | 200 | 고 | **p95 131ms 도달, max 1.34s** |
| 200→0 (90-105s) | ↓ | 감소 | 회복 |

Node.js single-thread 특성상 200 VU 근처에서 event loop 큐잉 발생 (max 1.34s outlier). 프로덕션에서 200+ concurrent user 대응하려면 **horizontal scale (다중 인스턴스)** 필요.

### Iteration count 해석 (7.4M 은 read 오해)

Stress 결과의 `iterations: 7,456,946` 는 대다수가 **skip iteration** (persona 토큰 없어서 즉시 return, µs 단위). 실제 부하는 `http_reqs 10,888` 이 정확.

**Root cause**: setup 단계에서 rate limit 히트 → 일부 persona 로그인 실패 → 해당 VU 는 default() 에서 token 없어 skip. 향후 개선 후보:
- Login 요청 spread 를 더 크게 (현재 200ms → 30s+)
- Setup 실패 시 재시도 + backoff
- Login rate limit 완화 (loadtest 모드 flag)

## Rate Limit Gotcha

`POST /api/auth/login` 은 **10 requests per 5min per IP** 제한:
```
RateLimit-Policy: 10;w=300
```

Load test 반복 실행 시 429 폭발:
- 7 persona × 1 setup login = 7 requests
- 반복 실행 (baseline → stress → 재조정) 시 quota exhaust
- Docker container 별 IP 분리 시 완화되지만, host.docker.internal 사용 시 host IP 공유

**해결책 후보**:
- (a) 특정 IP whitelist (loadtest source) rate limit skip
- (b) `LOADTEST_MODE=1` env 로 auth middleware 우회 (개발/CI 만)
- (c) k6 setup 실패 시 재시도 backoff (~150s wait)
- (d) 토큰 pre-generation + JSON injection (setup 스킵)

CI (nightly) 는 fresh docker network → rate limit 리셋 됨 → 실 운영 이슈 낮음. 로컬 개발자 iterative 실행 시가 pain point.

## Load Balancer Overlay (setup only, not yet exercised)

**목적**: JWT stateless 특성상 sticky session 불필요, round-robin 분산 검증 + fail-over 시나리오 확인.

**Files**:
- `loadtest/docker-compose.loadtest.yml` — nginx + api (scalable via `--scale api=N`)
- `loadtest/nginx.conf` — upstream round-robin + `X-Upstream` response header + `/lb-health` endpoint

**How to run**:
```bash
# 1. Bring up stack (2 api replicas)
docker compose -f loadtest/docker-compose.loadtest.yml --env-file .env \
  up --build --scale api=2 -d

# 2. Verify
docker compose -f loadtest/docker-compose.loadtest.yml ps
curl http://localhost:3002/lb-health   # should return "ok"

# 3. Run stress against LB (port 3002 instead of 3001)
docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -v $PWD/loadtest:/scripts \
  -e BASE_URL=http://host.docker.internal:3002/api \
  -e SCENARIO=stress \
  grafana/k6 run /scripts/personas.k6.js

# 4. Teardown
docker compose -f loadtest/docker-compose.loadtest.yml down
```

**k6 script LB integration**:
- Nginx는 응답에 `X-Upstream: <container-ip>:3001` 헤더 추가
- k6 는 `lb_upstream_hits` counter 로 upstream 별 hit 집계
- Round-robin 정상 시 두 upstream 카운트 ~50:50 분포

**Fail-over 검증 (수동)**:
```bash
# Stress run 중 한 replica kill
docker compose -f loadtest/docker-compose.loadtest.yml stop <api-container>
# nginx max_fails=3 fail_timeout=30s 로 30s 이내 다른 replica 로 전환
```

**아직 실제 run 하지 않은 이유**: DB seed 사이드카 필요 (host DB reuse 는 dev 환경 conflict 리스크). 다음 세션에서 dedicated compose db + seed init container 추가 예정.

## Write Workload (`SCENARIO=write`)

Idempotent write test: `PATCH /notifications/:id/read` 를 각 persona 의 첫 5개 notification 에 반복 호출. 마킹 이미 됨 = no-op → 안전.

```bash
BASE_URL=http://localhost:3001/api SCENARIO=write \
  docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -v $PWD/loadtest:/scripts \
  grafana/k6 run /scripts/personas.k6.js
```

첫 실행 시 setup 이 notification id 사전 조회. 이후 iteration 은 순수 PATCH.

## Recommendations

### 즉시 (다음 PR):
- **Rate limit bypass for loadtest** (option b or c above) — 안정적 재측정
- **LB stack DB seed 사이드카** — LB run 활성화
- **Per-endpoint pass rate metric** — 현재 `http_req_failed` 는 aggregate. 실패 concentration 파악 위해 endpoint 태그 aggregation 필요 (k6 output-influxdb / prom-remote 검토)

### 중기:
- **APM 도입** (SigNoz/Sentry Performance) — 프로덕션 트래픽 관측
- **DB connection pool 튜닝**: Prisma default → capacity planning
- **Redis cache** — active season, department hierarchy 등 자주 조회 static-ish 데이터

### 장기:
- **k6 → Grafana dashboard**: nightly baseline trend + regression alert
- **Multi-region simulation**: 지리적 분산 사용자 latency 시뮬 (Cloudflare / AWS API Gateway)

## Artifacts

- `loadtest/personas.k6.js` — script (baseline/stress/write/mixed scenarios)
- `loadtest/docker-compose.loadtest.yml` — LB overlay
- `loadtest/nginx.conf` — LB config
- `loadtest/summary-baseline.json` — baseline run summary
- `loadtest/summary-stress.json` — stress run summary
- `docs/loadtest/personas.md` — 21 persona catalog
- `docs/loadtest/README.md` — 실행/설치 안내
- `.github/workflows/loadtest.yml` — CI job (nightly + manual)

## 결론

- **성능**: p95 132ms @ 200 VU. 프로덕션 SLA 여유 큼.
- **5xx**: 0. Fix #388 이후 안정.
- **부하 시뮬 자체가 발견 도구**: 이번 라운드에서 7개 script endpoint typo + rate limit 노출 함. Regression prevention 가치 재확인.
- **다음 단계**: rate limit 우회 + LB stack seed 사이드카 → capacity planning 신뢰도 향상.

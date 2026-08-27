# Football ERP — Persona Load Test Report

**Run date**: 2026-08-27  
**Environment**: local (macOS, single node, PostgreSQL 로컬)  
**k6 version**: v1.3.0  
**API**: `pnpm run dev` (ts-node-dev, node 20)  
**Config**: 10 VUs × 30s, per-VU 1s sleep cycle

## Executive Summary

| Metric | Value | Verdict |
|---|---|---|
| Total requests | **907** | 27.7 req/s |
| p95 latency | **19.82ms** | 🟢 Excellent (threshold: <2000ms) |
| p90 latency | 14.58ms | 🟢 |
| Median latency | 3.95ms | 🟢 |
| Max latency | 93.4ms | 🟢 |
| Checks passed | **870/900 (96.66%)** | 🟢 |
| Checks failed | 30 (3.33%) | 🔴 concentrated: 1 endpoint |
| VUs | 10 (peak) | — |
| Iterations | 300 | — |

**Overall**: 성능 자체는 매우 양호 (p95 20ms 대). 신규 발견 **버그 1건**: `GET /api/medical-expenses` returns **500 INTERNAL_SERVER_ERROR** for MEDICAL_DIRECTOR persona. 나머지 20 endpoints 정상.

## Per-Persona Results

7 페르소나 × 3 endpoint = 21 endpoint 조합 검증. 각 VU 는 1개 페르소나에 round-robin 할당되어 3개 endpoint 순차 호출.

| Persona | Endpoints | 성공 | 실패 | 노트 |
|---------|-----------|------|------|------|
| HR_MANAGER | 3 | 3/3 | 0 | ✅ 정상 |
| HEAD_COACH | 3 | 3/3 | 0 | ✅ 정상 |
| FINANCE_MANAGER | 3 | 3/3 | 0 | ✅ 정상 |
| ASSET_MANAGER | 3 | 3/3 | 0 | ✅ 정상 |
| GM | 3 | 3/3 | 0 | ✅ 정상 |
| PLAYER | 3 | 3/3 | 0 | ✅ 정상 (self-service) |
| MEDICAL_DIRECTOR | 3 | 2/3 | 1 | 🔴 `/medical-expenses` 500 |

## 상세 endpoint 결과

### ✅ Working (20/21)

**HR_MANAGER**:
- `GET /hiring-surveys` — OK
- `GET /plan-reports` — OK
- `GET /recruitment/job-postings` — OK

**HEAD_COACH**:
- `GET /training` (list sessions) — OK
- `GET /players` — OK
- `GET /tactical` (list) — OK

**FINANCE_MANAGER**:
- `GET /operating-expense` — OK
- `GET /budget-plan` — OK
- `GET /financial-report` — OK

**ASSET_MANAGER**:
- `GET /equipment` (list items) — OK
- `GET /asset-request` — OK
- `GET /equipment/loans` — OK

**GM**:
- `GET /plan-reports?filter=pending-final` — OK
- `GET /report?filter=pending-final` — OK
- `GET /hiring-dispatch?filter=pending-dispatch` — OK

**PLAYER**:
- `GET /players/me` — OK
- `GET /training` — OK
- `GET /notifications` — OK

**MEDICAL_DIRECTOR**:
- `GET /injuries` — OK
- `GET /medical-equipment-loan` — OK

### 🔴 Failed (1/21)

- `GET /medical-expenses` (MEDICAL_DIRECTOR) — **500 INTERNAL_SERVER_ERROR** (`{"code":"INTERNAL_SERVER_ERROR"}`) — 100% (30/30) 실패
  - **재현**: `curl -H "Cookie: access-token=<meddir_token>" http://localhost:3001/api/medical-expenses` → 500
  - **원인 추정**: MEDICAL_DIRECTOR role 이 medical-expense list 에서 예상치 못한 crash. `MedicalExpenseService.list()` 나 permission check 에서 exception 던짐 가능
  - **follow-up 이슈 필요**: `bug(medical-expense): /medical-expenses returns 500 for MEDICAL_DIRECTOR persona`

## Latency Distribution

전체 request:
- **min**: 0.133ms
- **median**: 3.95ms
- **p90**: 14.58ms
- **p95**: 19.82ms
- **avg**: 6.56ms
- **max**: 93.4ms

Per-persona custom trend (`persona_latency`):
- **avg**: 5.97ms
- **median**: 3.9ms
- **p95**: 17.19ms
- **max**: 60.93ms

**해석**: 
- Latency 분포 매우 tight (median 4ms, p95 20ms). 이 정도 규모 (10 VUs) 에서는 DB · Node.js 오버헤드가 dominant, 네트워크는 무시할 만함.
- 프로덕션 SLA (p95 < 500ms) 대비 여유 25배. 부하 증가 여지 큼.

## Throughput

- **Total requests**: 907 in 32.7s → 27.7 req/s
- **Iterations**: 300 (10 VUs × 30 iterations)
- **Data**: 1.4MB received / 400KB sent
- **평균 iteration**: 1.01s (10개 endpoint call + 1s sleep)

## Bottleneck Analysis

10 VUs 부하에서는 병목 관찰 안 됨. 다음 스텝 조사 대상:
- 50 VU 이상 스트레스 테스트 시 p95 급증 지점 (DB connection pool exhaustion? Prisma engine bottleneck?)
- 쓰기 workload (POST/PATCH/DELETE) 부하 — 현재 read-only. HiringSurvey create, PlanReport submit 등 write-heavy 시나리오 별도 테스트 필요
- Concurrent write endpoints (bulk publish, promoteFromWaitlist race guards) 정합성 검증

## Recommendations

### 즉시 (this PR):
1. ✅ Persona catalog + k6 script + CI workflow (이 PR 로 landing)
2. 🔴 `/medical-expenses` 500 버그를 신규 이슈로 파일링 (follow-up)

### 후속:
- **Stress test**: 50/100/200 VUs 로 scaling 곡선 관찰 → capacity planning
- **Write workload test**: POST endpoints 대상 별도 script (rate limit + idempotency 관리)
- **Error tolerance**: `http_req_failed rate<0.10` threshold 는 4xx 도 포함. 4xx 는 정상 (auth 403 등) 이라 별도 metric (`persona_errors` count) 로 gating 강화
- **DB connection pool 튜닝**: 현재 Prisma default pool size 확인 후 부하 증가 시 조정
- **Cache**: 자주 조회되는 static-ish 데이터 (department 계층, seed users, active season) redis/in-memory cache 검토 (현재 미도입)
- **APM 도입**: NewRelic/DataDog/Sentry Performance 등 추가 검토 (production insight 필요 시)

## Rerun

로컬:
```bash
BASE_URL=http://localhost:3001/api VUS=10 DURATION=30s \
  k6 run loadtest/personas.k6.js --summary-export=loadtest/summary.json
```

CI (GitHub Actions): nightly UTC 03:00 자동 실행 + `workflow_dispatch` 수동 트리거. Results 는 `k6-results-<run_id>` artifact 로 14일 보관.

## Artifacts

- `loadtest/personas.k6.js` — script
- `loadtest/summary.json` — this run's k6 summary export
- `docs/loadtest/personas.md` — persona catalog (21개)
- `docs/loadtest/README.md` — 실행/설치 안내
- `.github/workflows/loadtest.yml` — CI job

## 향후 개선 idea

- **Graph-based scenario generation**: graphify graph 를 활용해 자주 함께 호출되는 endpoint 조합 자동 발견 → 시나리오 auto-generate
- **Multi-page workflow simulation**: 단순 endpoint call 아닌 실제 페이지 flow (예: login → dashboard → detail → action) 재현
- **Compare 2 releases**: nightly artifact 를 GitHub Actions matrix 로 main vs PR 브랜치 비교 → regression detect
- **Realistic think time**: `sleep(1)` 대신 `Math.random() * 3 + 1` 등 분포 도입
- **DB seed 다양성**: 현재 seed 는 소규모 (~50 users). 대용량 fixture (10K+ records) 시나리오 별도

## 결론

- 성능 자체는 **매우 양호** — p95 20ms 대에서 안정
- 부하 시뮬 자체가 **버그 발견 도구**로 유효 (medical-expenses 500 발견)
- CI 통합으로 **regression detect** 가능 (nightly baseline 축적 후 비교)
- 페르소나 카탈로그는 **QA · onboarding · 문서화 자료**로도 재사용 가치 높음

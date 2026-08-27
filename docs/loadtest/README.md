# Football ERP — Load Test with k6

## Prerequisites

1. **API server 실행** (localhost:3001):
   ```bash
   cd apps/api
   pnpm install
   pnpm prisma generate
   pnpm prisma db push  # or migrate deploy
   pnpm run seed        # 21 personas seeded (Password1!)
   pnpm run dev
   ```
2. **k6 설치**:
   - macOS: 공식 tap `brew install grafana/grafana/k6` (혹은 GitHub Releases 에서 바이너리 다운로드)
   - Linux: `sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 && echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list && sudo apt-get update && sudo apt-get install k6`
   - Docker: `docker run --rm -i grafana/k6 run - <script.js`

## 실행

기본 (10 VUs × 30초):
```bash
k6 run loadtest/personas.k6.js
```

환경 변수 override:
```bash
BASE_URL=http://localhost:3001/api \
VUS=20 DURATION=2m \
  k6 run loadtest/personas.k6.js --summary-export=loadtest/summary.json
```

Stage-based ramp:
```bash
# k6 config 직접 수정하거나 --stage 로 override
k6 run --stage 30s:5,3m:20,30s:0 loadtest/personas.k6.js
```

## 결과 해석

### Thresholds (script default)
- `http_req_duration p(95)<2000` — 95% 응답 < 2초
- `http_req_failed rate<0.10` — 에러율 < 10%
- `persona_errors count<50` — 페르소나별 총 에러 < 50

### Metrics (custom)
- `persona_latency{persona=X, endpoint=Y}` — 각 페르소나·endpoint 별 latency Trend
- `persona_errors{persona=X, endpoint=Y}` — 페르소나·endpoint 별 error count

### Summary export
```bash
--summary-export=loadtest/summary.json
```
JSON 결과로 CI 파이프라인에서 지표 추출 가능.

## CI/CD

`.github/workflows/loadtest.yml` — nightly (매일 오전 3시 UTC) + manual dispatch. 매 커밋마다 안 돌림 (부하 큼).

## 시나리오 확장

`loadtest/personas.k6.js` 의 `PERSONAS` 배열에서 endpoint 추가/변경:
- write endpoint 추가 시 rate limit + side-effect 주의 (POST 는 idempotent 아님)
- 새 페르소나 추가 시 seed 유저 credential 확인
- 스테이지 기반 부하 (`stages` option) 도입 시 `options.duration` 대신 `options.stages` 사용

## 참고

- 페르소나 카탈로그: [`docs/loadtest/personas.md`](personas.md)
- 실행 결과 보고서: [`docs/loadtest/report.md`](report.md) (nightly 로 갱신됨 or PR 로 manual 갱신)

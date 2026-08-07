# 내일 할일 — 2026-08-08

> 근거: `2026-08-07-persona-critical-findings.md` 페르소나 리뷰 (9 페르소나, 90 criticals)

---

## 즉시 처리 (보안·규정 — 가장 먼저)

### [J2] 원장 환불 권한 무방비
- `ledger.controller.ts:17` refund 엔드포인트에 `canWriteFinance` 가드 추가

### [J3] 원장 조회 권한 제한
- `ledger.controller.ts:8` 전체 원장 조회에 finance 권한 체크 추가

### [BH3] 부하 초과 알림에 의료진 미포함
- `training-load.service.ts:47` 알림 수신 대상에 MEDICAL_DIRECTOR, MEDICAL 추가

---

## 단기 처리 (데이터 정합성)

### [KN9] 부하 초과 알림 fire-and-forget 개선
- `training-load.service.ts:50` 알림 실패 로깅 + 재시도 또는 DB 기록

### [BH9] MatchAvailable과 훈련 부하 연동
- 의료진 matchAvailable 설정 시 해당 선수 최근 4주 부하 요약을 같이 표시

### [KN4] PerformanceScore 범위 검증
- `training.dto.ts:25` min(1) max(100) 제약 추가

### [KN5] 주간 부하 집계 타임존 처리
- `training-load.service.ts:87` getWeekStart()에 KST(UTC+9) 오프셋 적용

### [BH1] RPE 기본값 5 → null 처리
- `training-load.repo.ts:27` 미입력 RPE는 null로 저장, 집계 시 null 명시 표시

---

## 중기 처리 (분석 인프라)

### [BH5] Acute:Chronic 부하 비율 계산
- `training-load.service.ts` 당주 부하 / 최근 4주 평균 A:C ratio 계산 API 추가
- 대시보드에 선수별 A:C ratio 표시 (>1.3 = 위험 경고)

### [KN3] 포지션별 부하 임계값
- `training-load.service.ts:6` 단일 500 → 포지션별 threshold 테이블 (GK/DEF/MID/FWD)

### [KN7] 부하-RPE 연관 분석
- 선수별 훈련 부하 + RPE 동시 조회 API / 차트 추가

### [KN8] 세션별 목표 부하(targetLoad) 필드
- `schema.prisma` TrainingSession에 targetLoad 필드 추가
- 코치가 세션 생성 시 목표 부하 입력 → 실제 부하와 비교 뷰

### [BH6] 복귀 단계 전이 조건 검증
- REHABILITATING → READY_TO_RETURN 상태 변경 시 최소 기간 또는 의무팀 서명 필요 여부 추가

### [KN10] 부하 이력 upsert → append 전환
- `training-load.repo.ts:21` 이전 값 소실 문제 — 이력 테이블로 분리 또는 버전 컬럼 추가

---

---

## 스폰서십·파트너십 (빠뜨롱)

### [PA5] 원장 연계 무음 실패 수정 — 즉시
- `sponsorship.service.ts:81` void+catch 제거, await + 트랜잭션으로 변경
- 원장 등재 실패 시 지불 마킹도 롤백

### [PA7 / PB7] 지불 현황 조회 인증 추가 — 즉시
- `sponsorship.controller.ts:49` requireUser() + canWriteFinance 가드 추가

### [PA3] SponsorshipPayment onDelete 정책 추가
- `schema.prisma` SponsorshipPayment에 onDelete: Restrict 또는 Cascade 명시

### [PA10] 지불 금액 검증 추가
- `sponsorship.repo.ts:67` amount > 0, 계약 총액 초과 방지 검증

### [PA2 / PB10] 분할 금액 정밀도 수정
- `sponsorship.service.ts:46` Decimal 라이브러리 or 정수 원 단위 계산으로 반올림 오차 제거

### [PB1] 계약 변경 감사 로그 추가
- `sponsorship.service.ts:59` update() 시 변경 전·후 값 감사 로그 기록

### [PA9 / PB8] 스폰서십 만료 알림 자동화
- `sponsorship` 모듈에 findExpiringContracts() 추가 + cron 알림

### [PB5 / PB9] ops-report에 스폰서 KPI 추가
- 스폰서 납부 실적 vs 계획, 파트너 성과 KPI 집계

---

## 참고

- 전체 findings: `docs/superpowers/specs/2026-08-07-persona-critical-findings.md`
- 10 페르소나 / 110 criticals 누적

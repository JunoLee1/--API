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

## IT·데이터 보안 (이상훈 + Rachel) — 즉시 처리

### [IS2/RA4] JWT 시크릿 기본값 교체
- `.env` JWT_ACCESS_TOKEN_SECRET, JWT_REFRESH_TOKEN_SECRET 강력한 랜덤값으로 교체
- `constants.ts:4` 폴백 기본값 제거, 미설정 시 서버 기동 실패 처리

### [IS3] 전화번호 암호화 키 환경변수 분리
- `.env:18` PHONE_ENCRYPTION_KEY 신규 생성 후 보안 저장소로 이관

### [IS7/RA1/RA2] 부상 정보 접근 제어 추가
- `injury.controller.ts:23` getActive()에 MEDICAL·ADMIN 역할 제한
- `injury.controller.ts:57` getReport()에 requireUser + 역할 체크

### [IS8] safeguard 신고 인증 추가
- `safeguard.controller.ts:8` requireUser() 추가

### [IS10] 학비 엔드포인트 권한 추가
- `academy-fee.controller.ts` getAll()·issueMonthlyFees()·approvePayment()에 역할 가드

### [RA3] DB 자격증명 보안 강화
- `.env:12` postgres:1234 → 강력한 비밀번호로 교체

### [IS9] 감사 로그 불변 보호
- `auditLog.ts` update·delete 비허용 정책 추가 (Prisma middleware 활용)

---

## 시설 관리 (김동욱 + Trevor)

### [KD6] 시설 예약 모델 신설
- `schema.prisma` FacilityReservation 모델 추가 (facilityId, startTime, endTime, reservedBy, purpose)

### [KD8/TR3] 안전점검 만료 알림 cron 추가
- inspection 만료 30/7일 전 담당자 알림

### [KD4/TR6] 유지보수 비용 변경 감사 로그
- `maintenance.service.ts:65` actualCost 변경 시 감사 로그 기록

---

## 채용 파이프라인 (서지혜 + Claire)

### [SJ1/CL3] 지원자 상태 변경 감사 로그
- `recruitment.repo.ts:102` writeAuditLog() 추가

### [SJ2/CL2] 거절 사유 필드 추가
- `schema.prisma` JobApplication에 rejectionReason, rejectionAt 추가

### [CL4/SJ6] 면접 일정 지원자 통보
- Interview 생성 시 지원자 이메일 알림 발송

### [SJ7] 채용 목표 인원 진척률 집계
- headcount 대비 HIRED 수 집계 API 추가

---

## 팬 운영·티켓 (박성준 + Jordan)

### [BS1/JO1/BS7] SalesRecord soft-delete + 트랜잭션
- `sales.repo.ts` 물리 삭제 → soft-delete(deletedAt) 전환
- `sales.service.ts` delete()에 LedgerEntry 연동 트랜잭션

### [JO5/J2] 환불 권한 가드
- `ledger.routes.ts:16` canWriteFinance 가드 추가

### [BS3/JO9] Ticket·Fan·Membership 모델 설계
- `schema.prisma` Ticket, Fan, Membership 기본 모델 추가 (장기 과제)

---

## 참고

- 전체 findings: `docs/superpowers/specs/2026-08-07-persona-critical-findings.md`
- 18 페르소나 / 190 criticals 누적

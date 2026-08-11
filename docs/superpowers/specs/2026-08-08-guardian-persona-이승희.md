# 이승희 — 학부모 (한국인, GUARDIAN 역할) 페르소나 리뷰

> 작성일: 2026-08-08
> 방법: 페르소나 에이전트 독립 코드 리뷰

> "우리 준혁이 훈련 잘 나가고 있는 건지 도대체 어디서 확인해요? 부상은 없나요? 이달 회비는 또 언제 내야 하죠?"

**페르소나**: 이승희, 아들 이준혁(15세, FC Seoul U-15 센터백)의 학부모. 국가대표 수비수를 꿈꾸는 아들을 응원하는 열성 한국인 어머니.

## 핵심 고통점

| # | 제목 | 파일:라인 | 핵심 문제 |
|---|------|----------|-----------|
| SH1 | 훈련 출결 조회 불가 | `training/training.routes.ts:16-24` | GUARDIAN 역할에 훈련 세션 조회 권한 없음. 아들의 훈련 출결 기록(참석/결석/지각) 확인 불가 |
| SH2 | 부상 정보 조회 불가 | `injury/injury.routes.ts:17-26` | 부상 발생 알림은 받지만 상세 정보(부상 부위·회복 예상일)를 직접 열람할 엔드포인트 없음 |
| SH3 | 학비 조회·납부 증빙 제출 불가 | `academy-fee/academy-fee.routes.ts:14-19` | 월 청구액, 납부 기한, 납부 상태 조회 불가. 납부 증빙 제출도 불가 |
| SH4 | 경기 결과·개인 스탯 조회 불가 | `match/match.routes.ts` | 다음 7일 경기만 제공. 지난 경기 결과, 출전 시간, 득점·어시스트 조회 불가 |
| SH5 | 성장평가 이력 조회 불가 | `guardian/guardian.repo.ts:98-105` | 최신 평가 1건만 대시보드에 표시. 이전 평가 이력 비교 불가 |
| SH6 | 초대 코드 발급 경로 불명확 | `guardian/guardian.service.ts:9-30` | GUARDIAN이 자녀 연동을 위한 초대 코드를 어디서 요청하는지 API 없음 |
| SH7 | 참가 정지 사유 불명확 | `academy-fee/academy-fee.service.ts:49-51` | 학비 미납·부상 중 어떤 이유로 정지인지 대시보드에 명시 없음 |
| SH8 | 부상·결석 인과관계 미표시 | `training/training.repo.ts:82-114` | 부상으로 인한 ABSENT_AUTHORIZED와 무단 결석이 구분 없이 결석 카운트로 합산됨 |
| SH9 | 의료비·병원 정보 없음 | 없음 | 부상 치료 병원, 치료비, 보험 청구 여부 정보 미제공 |
| SH10 | requireGuardianChild 미사용 | `guardian/guardian.middleware.ts:11-28` | 자녀 확인 미들웨어 정의만 있고 실제 라우트에 미적용 → 타인 자녀 정보 접근 위험 |

## 우선 구현 권장 항목
- GUARDIAN용 `/training/my-child/attendance` 출결 조회 엔드포인트
- GUARDIAN용 `/injuries/my-child` 부상 상세 조회 엔드포인트
- GUARDIAN용 `/academy-fees/my-child` 학비 조회 + `submit-proof` 엔드포인트
- `getDashboard`에 현재 정지 상태 필드 추가 (사유 포함)
- `requireGuardianChild` 미들웨어 라우트에 실제 적용

## 요약
ERP가 GUARDIAN 역할을 설계에 포함했으나 실제 기능은 대시보드 1개 스냅샷에 그침. 학부모가 가장 필요로 하는 출결·부상·학비 정보 접근이 모두 차단되어 있어 전화 문의 외 다른 방법이 없는 상태.

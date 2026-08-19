# FC Seoul ERP — 페르소나 Critical 피드백 종합

> 작성일: 2026-08-17  
> 세션: feat/security-facility-issues 브랜치 기준  
> 방법: 22개 페르소나 에이전트 독립 코드 리뷰 (2026-08-07 대비 신규 이슈 중심)

---

## 페르소나 목록

| # | 페르소나 | 역할 | 담당 섹션 | Critical 수 |
|---|----------|------|-----------|-------------|
| 1 | **Steve** | HR 담당자 (한국, 5년차) | HR 보고서·인사관리 | 10 |
| 2 | **이연주** | K리그 HR팀장 (한국, 5년차) | HR 보고서·인사관리 | 10 |
| 3 | **Rooney** | FC Seoul 구단주 (영국, ROI 중시) | 선수계약·선수관리 | 10 |
| 4 | **David Park** | 구단 관리자 (한국계 영국, 맨유 10년) | 선수계약·선수관리 | 10 |
| 5 | **Jack** | 재무팀장 (영국, 5년차, 감사 기준 높음) | 재무 보고서 관리 | 10 |
| 6 | **이영표** | Technical Director (한국, 10년차, T형) | 전술·훈련 데이터 | 10 |
| 7 | **Megan** | 의무팀장 (영국, 첼시 15년차) | 부상관리·재활·의료비 | 10 |
| 8 | **Kane** | Technical Director 컨디셔닝 (영국, 15년차) | 선수 컨디셔닝·훈련 부하 | 10 |
| 9 | **박희수** | 의무팀 (한국, 15년차) | 선수 컨디셔닝·훈련 부하 | 10 |
| 10 | **빠뜨롱** | 자산관리사 (한국, 15년차, T형) | 스폰서십·파트너십 | 10 |
| 11 | **김동욱** | 시설관리팀장 (한국, 18년차) | 시설 관리·장비 관리 | 10 |
| 12 | **Trevor** | Stadium Operations Manager (영국, 14년차) | 시설 관리·장비 관리 | 10 |
| 13 | **서지혜** | 채용팀장 (한국, 11년차) | 채용·인재 파이프라인 | 10 |
| 14 | **Claire** | Talent Acquisition Director (영국, 9년차) | 채용·인재 파이프라인 | 10 |
| 15 | **박성준** | 팬서비스팀장 (한국, 8년차) | 팬 운영·티켓 | 10 |
| 16 | **Jordan** | Head of Ticketing & Fan Engagement (영국, 16년차) | 팬 운영·티켓 | 10 |
| 17 | **이상훈** | IT보안팀장 (한국, 13년차) | IT·데이터 보안 | 10 |
| 18 | **Rachel** | Head of Information Security (영국, 11년차) | IT·데이터 보안 | 10 |
| 19 | **정훈** | 유소년 HEAD_COACH (한국) | 유소년·학부모 | 10 |
| 20 | **이승희** | 학부모/Guardian (한국) | 유소년·학부모 | 10 |
| 21 | **알렉스 퍼거슨** | 1군 감독 (영국, 20년차) | 훈련·전술 총괄 | 10 |
| 22 | **Ash** | UX/UI Design Lead (영국, 10년차) | 프론트엔드 UX/접근성 | 10 |

**총계: 22개 페르소나 × 10 criticals = 220개 이슈**

---

## 반복 패턴 요약

| 패턴 | 관련 페르소나 | 빈도 |
|------|-------------|------|
| fire-and-forget async (void + .catch) | Jack, Kane, 박희수, 이영표 | 4+ |
| 감사 로그(audit log) 누락 | Steve, 이연주, 빠뜨롱, 김동욱 | 4+ |
| 인가(authorization) 체크 누락 | 이상훈, Rachel, 서지혜, 빠뜨롱 | 4+ |
| ACWR 더블카운팅 버그 | Kane, 이영표 (독립 확인) | 2 |
| 다통화 → KRW 하드코딩 | Jack, 빠뜨롱 | 2 |
| 학부모 알림 누락 | 정훈, 이승희 | 2 |
| 비가역적 UI 액션에 확인 다이얼로그 없음 | Ash | 다수 |

---

## 섹션 1: HR 보고서 · 인사관리

### Steve (HR 담당자, 한국, 5년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| S1 | HR 문서 업로드가 파일을 즉시 폐기 | `apps/api/src/hr/hr.controller.ts:3` | `uploadDocument`가 `multer.memoryStorage()` 사용 — 버퍼가 디스크·S3 어디에도 저장되지 않음. 모든 HR 문서 업로드가 silent drop. |
| S2 | 출결 보고서가 LATE_AUTHORIZED 레코드를 silent drop | `apps/api/src/hr-report/hr-report.repo.ts:133` | `getAttendance()`가 고정 상태 목록만 읽고 `LATE_AUTHORIZED`는 누락, 월별 합계가 틀림. |
| S3 | 임금 분석이 선수 계약만 집계 — 스태프 급여 제외 | `apps/api/src/hr-report/hr-report.repo.ts:195` | `getWageAnalysis()`가 `prisma.contract`(선수 전용)만 조회, `StaffSalary` 완전 누락. |
| S4 | 급여 list·get 엔드포인트에 인가 체크 없음 | `apps/api/src/payroll/salary/salary.controller.ts:11,17` | PLAYER, AGENT, GUARDIAN 포함 모든 인증 사용자가 전체 스태프 급여를 열람 가능. |
| S5 | 스태프 레코드 수정에 감사 로그 없음 | `apps/api/src/staff-record/staff-record.service.ts:47` | `update()`가 이름·역할·부서·활성상태 변경 시 `writeAuditLog` 미호출. `terminate()`만 기록. |
| S6 | 스태프 레코드 하드 삭제에 가드·감사 로그 없음 | `apps/api/src/staff-record/staff-record.service.ts:60` | 연결된 급여 레코드 확인 없이 하드 삭제. 한국 노동법상 고용 기록 보관 의무 위반 위험. |
| S7 | StaffSalary에 `effectiveTo` 없음 — 급여 이력 복구 불가 | `apps/api/prisma/schema.prisma:2915` | `effectiveFrom`만 있어 `update()` 시 이전 급여가 덮어씌워짐. 이력 추적 불가. |
| S8 | 급여 실행 생성·확정에 감사 로그 없음 | `apps/api/src/payroll/run/run.service.ts:40,96` | `createRun()`·`confirmRun()` 모두 `AuditLog` 미기록. 누가 급여를 집행했는지 불명. |
| S9 | 부서 삭제 시 소속 스태프 존재 여부 미확인 | `apps/api/src/department/department.service.ts:41` | `delete()`가 하위 부서만 확인. 스태프 배정된 부서 삭제 시 `departmentId`가 NULL로 silent set. |
| S10 | HR_STAFF / HR_MANAGER가 스태프 레코드 조회·수정 불가 | `apps/api/src/staff-record/staff-record.controller.ts:7` | `canWrite`/`canRead` 가드가 `canWriteHR`/`canReadHR`를 우회, HR 담당자가 주요 업무 수행 불가. |

### 이연주 (K리그 HR팀장, 한국, 5년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| Y1 | 연간 임금 총액이 선수 계약만 집계 — 스태프 급여 누락 | `apps/api/src/hr-report/hr-report.repo.ts:195` | `getWageAnalysis()`가 `Contract` 모델(선수 전용)만 조회, `StaffSalary` 미포함. |
| Y2 | 채용 수요 조사 생성·마감에 권한 검증 없음 | `apps/api/src/hiring-survey/hiring-survey.routes.ts:19,22` | `POST /`(생성)·`POST /:id/close`(마감)에 `auth`만 있고 HR 역할 체크 없음. 선수도 마감 가능. |
| Y3 | 부서 계층에 순환 참조 방지 로직 없음 | `apps/api/src/department/department.service.ts:34` | `update()`의 `parentId` 갱신 시 자기 자신·하위 부서를 조상으로 설정하는 순환 계층 허용. |
| Y4 | 검토자 0명이면 계획서 검토 단계 즉시 통과 — 승인 우회 | `apps/api/src/plan-review/plan-review.repo.ts:41` | `allConfirmed()`가 `total === 0`이면 `true` 반환. 검토자 없으면 검토 없이 임원 승인 직행. |
| Y5 | 계획서 검토에 REJECT 기능 없음 | `apps/api/src/plan-review/plan-review.routes.ts:1` | `REJECTED` 상태가 스키마에 있으나 서비스·라우트에 `reject` 엔드포인트 없음. |
| Y6 | 부서 인원 구조·헤드카운트 드릴다운 API 없음 | `apps/api/src/department/department.controller.ts:17` | 부서 조회가 계층 구조만 반환, 소속 인원 수·활성 스태프 수·예산 현황 없음. |
| Y7 | 월간 출석률이 선수 훈련 결과만 — 코칭·프론트 스태프 제외 | `apps/api/src/hr-report/hr-report.repo.ts:134` | `getAttendance()`가 `TrainingResult.playerId` 기준만 집계, 스태프 출석 데이터 없음. |
| Y8 | 비선수 스태프 이직률이 연간 보고서에 미반영 | `apps/api/src/hr-report/hr-report.service.ts:83` | `getAnnual()` 이직률 계산이 `Transfer` 모델(선수 이적)에만 의존, `StaffRecord.terminatedAt` 미활용. |
| Y9 | 부서장 변경에 감사 로그 없음 | `apps/api/src/department/department.service.ts:28` | `update()`에서 `headId` 포함 부서 정보 변경 시 `writeAuditLog()` 미호출. |
| Y10 | 채용 수요 조사 참여율 집계 API 없음 | `apps/api/src/hiring-survey/hiring-survey.routes.ts:1` | 진행 중 조사의 응답 부서 수·미응답 부서 목록 반환 엔드포인트 없음. |

---

## 섹션 2: 선수계약 · 선수관리

### Rooney (FC Seoul 구단주, 영국, ROI 중시) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| R1 | 이적 PnL이 최초 취득 원가를 무시 — 진짜 ROI 불가 | `apps/api/src/contract/contract.repo.ts:182-193` | `getTransferPnL()`이 `fee` 합산만 하고 취득 원가·급여 상각 연계 없음. |
| R2 | 임금 총액에 에이전트 수수료 미포함 | `apps/api/src/contract/contract.repo.ts:132-156` | `getSquadSalaryByPosition()`이 `salary`만 합산, `agencyCommission` 집계 누락. |
| R3 | 성과 보너스 트리거 후 급여·원장 반영 없음 | `apps/api/src/jobs/contractClauseExecution.ts:58-89` | `triggeredAt`만 기록하고 `executedAt`·급여 항목·원장 분개 생성 없음. 부채가 장부에 계상 안 됨. |
| R4 | P&L 보고서가 이적료를 지출·수입에서 완전 누락 | `apps/api/src/financial-report/financial-report.service.ts:242-358` | `getPnL()`이 급여·운영비·의료비만 포함, `Transfer.fee` 참조 없음. |
| R5 | 임금 상한 체크가 보너스·에이전트 수수료 제외 | `apps/api/src/contract/wage-cap.service.ts:35-51` | 최대 보너스 노출·수수료 미포함, 구조적 상한 위반 계약 체결 가능. |
| R6 | 스쿼드 플랜에 급여 비용 추정치 없음 | `apps/api/src/squad-plan/squad-plan.repo.ts:7-45` | `SquadPlan.slots`가 raw JSON으로 활성 계약 급여와 join 없음. |
| R7 | Prospect 파이프라인에 스카우팅·계약 비용 추적 없음 | `apps/api/src/contract/contract.repo.ts:218-237` | `getProspectCostSummary()`가 상태별 헤드카운트만 반환, 금전적 차원 없음. |
| R8 | 만료 임박 계약 목록에 잔여 계약 부채 미표시 | `apps/api/src/contract/contract.repo.ts:158-180` | 시장 가치·만료일 반환하지만 잔여 급여 총액·대체 비용 추정치 없음. |
| R9 | 보너스 트리거 평가가 GOALS/ASSISTS/APPEARANCES 3개만 처리 | `apps/api/src/jobs/contractClauseExecution.ts:50-56` | 12개 `BonusMetric` 중 9개가 `currentValue = 0` fallthrough. 숨겨진 우발부채. |
| R10 | ContractDetailPage에 에이전트 수수료·계약 총가치 미표시 | `football/src/pages/contracts/ContractDetailPage.tsx:296-404` | `agencyCommission` 저장되지만 미표시. 계약 총비용(급여×기간+수수료+최대보너스) 계산 없음. |

### David Park (구단 관리자, 한국계 영국, 맨유 10년) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| D1 | 중복 활성 계약 가드 없음 | `apps/api/src/contract/contract.service.ts:30` | `createContract`가 동일 선수의 기간 중첩 `ACTIVE` 계약 존재 여부를 확인하지 않음. |
| D2 | 계약 상태 머신에 임의 전환 허용 | `apps/api/src/contract/contract.service.ts:66` | `updateStatus`가 전환 유효성 검증 없이 어떤 enum 값이든 직접 저장. `TERMINATED→ACTIVE` 허용. |
| D3 | 계약 생성 시 시작일·종료일 순서 미검증 | `apps/api/src/contract/contract.repo.ts:52` | `endDate < startDate` 계약이 Prisma에 silent persist. |
| D4 | 소환(Recall) 승인 시 선수 팀·계약 상태 미업데이트 | `apps/api/src/transfer/transfer.repo.ts:60` | `updateRecallStatus`가 `Recall.status`만 변경, 임대 선수의 `teamId` 복원 없음. |
| D5 | 외국인 쿼터 체크 없음 | `apps/api/src/contract/contract.service.ts:30` | `createContract`·`confirm` 어디서도 국적 수를 쿼터 한도와 비교하지 않음. |
| D6 | 유소년 선수 전환 시 바이오메트릭 기본값이 쓰레기값 | `apps/api/src/youth-registration/youth-registration.repo.ts:67` | `contractAndCreatePlayer`가 `height: 0`, `weight: 0`, `preferredFoot: "RIGHT"`, `position: "STRIKER"` 하드코딩. |
| D7 | OFFICIAL 콜업 `complete()`가 선수를 잘못된 방향으로 복귀 | `apps/api/src/player-callup/player-callup.service.ts:213` | `complete()`가 선수를 청소년 원 팀으로 이동시키지만 `approve`가 이미 1군으로 이동시켰음. 상태 루프 발생. |
| D8 | TRAINING 콜업은 거절 불가 | `apps/api/src/player-callup/player-callup.service.ts:148` | `reject()`가 `DOCS_SUBMITTED` 상태에서만 작동하지만 TRAINING 타입은 그 상태에 도달하지 않음. |
| D9 | PLAYER_FIFA_ID 인증이 등록·이적 전 미검증 | `apps/api/src/certification/certification.service.ts:20` | 계약 생성·콜업 승인 어디서도 `VALID` FIFA ID 인증 조회 없음. |
| D10 | 관리자가 상태 직접 업데이트로 보호자 동의 단계 우회 가능 | `apps/api/src/youth-registration/youth-registration.service.ts:78` | `updateStatus`가 `"CONTRACTED"` 직접 수용, 미성년자 보호자 동의 게이트 우회 가능. |

---

## 섹션 3: 재무 보고서 관리

### Jack (재무팀장, 영국, 5년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| J1 | `createAutoEntry`가 기간 잠금을 우회 | `apps/api/src/ledger/ledger.service.ts:88` | `createAutoEntry` 헬퍼가 `isPeriodLocked` 체크를 명시적으로 건너뜀. 잠긴 기간에 새 분개 가능. |
| J2 | 급여 원장이 `grossPay` 대신 `netPay` 기록 | `apps/api/src/payroll/run/run.service.ts:85` | EXPENSE 분개에 실수령액 기록, 공제액만큼 원장·P&L 급여 비용 과소 계상. |
| J3 | 급여 원장 기록이 fire-and-forget — 트랜잭션 안전성 없음 | `apps/api/src/payroll/run/run.service.ts:82` | `void ... .catch(console.error)`로 발사 후 망각. DB 기록 실패 시 급여 실행은 잠기고 원장은 없음. |
| J4 | `LedgerEntry`에 `reversalOfId` 컬럼 없음 | `apps/api/src/ledger/ledger.service.ts:62` | `createRefund`가 `reversalOfId`를 `as any` 캐스팅으로 전달, Prisma가 silent drop. 환불 연결 단방향. |
| J5 | 스폰서십 `markPaid`가 `payment.amount` 사용, `adjustedAmount` 무시 | `apps/api/src/sponsorship/sponsorship.service.ts:127` | 조정 금액이 있어도 원장에 원래 금액이 기록됨. |
| J6 | 외화 스폰서십 결제가 항상 `exchangeRate: 1`로 기록 | `apps/api/src/sponsorship/sponsorship.service.ts:131-132` | `markPaid`가 `currency: "KRW"`, `exchangeRate: 1` 하드코딩. 비KRW 결제가 원장 `amountKrw` 오염. |
| J7 | `OperatingExpense` MEAL·MEDICAL 카테고리 차단됨 | `apps/api/src/operating-expense/operating-expense.service.ts:5` | `DISCRETIONARY`가 4/6 카테고리만 포함. MEAL·MEDICAL 실비가 예산 대비 실적 보고서에 항상 0. |
| J8 | `FinancialReport` 수익 분류 필드가 `Int` — 소수점 손실 | `apps/api/src/financial-report/financial-report.repo.ts:40` | 8개 수익 컬럼이 `Int`인데 `LedgerEntry.amount`는 `Decimal(14,2)`. 소수 부분 silent truncation. |
| J9 | Toss 웹훅에 서명·HMAC 검증 없음 | `apps/api/src/academy-fee/academy-fee.routes.ts:61` | 인증 없는 HTTP 클라이언트가 `DONE` 이벤트를 POST해 실제 `PAID` 상태 변경·원장 수입 분개 트리거 가능. |
| J10 | `SalesRecord` 수정 시 원장 금액 in-place 덮어쓰기, 감사 로그 없음 | `apps/api/src/sales/sales.service.ts:287` | `ledgerEntry.updateMany`가 기간 잠금·감사 로그 없이 `amount`·`amountKrw` silent 덮어씀. |

---

## 섹션 4: 전술 · 훈련 데이터

### 이영표 (Technical Director, 한국, 10년차, T형) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| E1 | ACWR 만성 부하를 실제 데이터 밀도 무관하게 4로 나눔 | `apps/api/src/training-load/training-load.service.ts:164` | `chronicWeeklyAvg = totalLoad / 4` — 28일 윈도우에 4주 미만 데이터가 있어도 4로 나눔. 만성 평균 과장. |
| E2 | 세 가지 부하 쿼리 메서드가 취소된 세션을 모두 포함 | `apps/api/src/training-load/training-load.repo.ts:56,87,142` | `getWeeklyLoadTotal`, `getInjuryLoadCorrelation`, `getLoadsBetween`에 `cancelledAt: null` 조건 없음. |
| E3 | 포메이션 결과 상관관계에서 `isHome` 감지가 항상 `true` | `apps/api/src/tactical/tactical.repo.ts:200` | `const isHome = !!a.match.teamId` — 원정 결과가 모두 홈으로 분류, 포메이션 승률 데이터 오염. |
| E4 | ACWR 엔드포인트가 프론트엔드에서 미호출 — 실질적 dead code | `apps/api/src/training-load/training-load.routes.ts:20` | `/acute-chronic/:playerId` 등록되었으나 프론트 컴포넌트가 아무도 호출 안 함. |
| E5 | 발달 계획에 구조적 목표 지표 없음 — 자유 텍스트만 | `apps/api/src/development-plan/dto/development-plan.dto.ts:4` | `goals`가 plain `string`. 정량 KPI·마일스톤 날짜·진척 자동 업데이트 없음. |
| E6 | `countUnexcusedAttendance`가 전 시즌 누적 — 시즌 범위 없음 | `apps/api/src/training/training.repo.ts:135` | `seasonId` 필터 없이 `groupBy` 조회. 이전 시즌 결석이 현 시즌 페널티 임계치에 계속 누적. |
| E7 | `SessionType`에 `MATCH_DAY`·`RECOVERY` 없음 | `apps/api/src/generated/enums.ts:285` | 경기 당일 신체 부하가 ACWR 윈도우에 미포함, 7일 급성 부하 윈도우 불완전. |
| E8 | 사후 전술 분석의 `improvementPlayerId`가 발달 계획에 연결 안 됨 | `apps/api/src/tactical/tactical.service.ts:48` | 개선 대상 선수 표시가 발달 계획에 관찰 내용을 추가하지 않음. 분석→피드백 루프 단절. |
| E9 | 포메이션 스냅샷 진화가 전술 분석과 완전 분리 | `apps/api/src/formation-snapshot/formation-snapshot.service.ts:1` | `FormationSnapshotService`가 `TacticalAnalysis` 참조 없음. 포메이션 변경과 사후 분석 조정 불가. |
| E10 | `getPlayerGrowthTrajectory`가 결석 주 silent skip — 궤적 불연속 | `apps/api/src/training-load/training-load.repo.ts:104` | `performanceScore: { not: null }` 필터로 결석 주 생략, 4주 이동 평균 윈도우가 데이터 간격 없이 연속처럼 보임. |

---

## 섹션 5: 부상 관리 · 재활 · 의료비

### Megan (의무팀장, 영국, 첼시 15년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| M1 | 부상 중증도·메커니즘 필드 없음 | `apps/api/prisma/schema.prisma:1186` | `Injury` 모델에 중증도 등급, 접촉/비접촉 메커니즘, 경기장 위치 없음. UEFA/FIFA 최소 부상 감시 데이터셋 미충족. |
| M2 | 모든 COACHING_STAFF가 부상 기록 생성 가능 | `apps/api/src/injury/injury.controller.ts:8` | `MEDICAL_ROLES = ["ADMIN", "COACHING_STAFF"]` — HEAD_COACH·PHYSICAL_COACH가 임상 책임 없이 부상 기록·평가 가능. |
| M3 | 실제 복귀일 미기록 | `apps/api/src/injury/injury.repo.ts:141` | `updateStatus()`가 `expectedReturnDate`만 설정, `actualReturnDate` 필드 없음. 재발 간격 분석 불가. |
| M4 | 부상 선수 훈련 부하 기록 시 차단 없음 | `apps/api/src/training-load/training-load.service.ts:60` | 활성 부상 선수 감지 시 `console.warn`만 출력하고 계속 진행, 부하 레코드 silent persist. |
| M5 | 세이프가드 보고에 신고자 신원·익명 보호 없음 | `apps/api/src/safeguard/safeguard.controller.ts:8` | `reporterId`·`reporterRole`·IP 감사 로그 없는 익명 제출 허용. 경찰 보고 기한이 3일(1일 기준 위반). |
| M6 | 의료 보고서 서명 취소에 감사 로그 없음 | `apps/api/src/injury/injury.service.ts:195` | `unsignReport()`가 `writeAuditLog` 미호출. 의무부장이 복귀 허가 서명을 기록 없이 취소 가능. |
| M7 | 의료비 영수증 업로드에 MIME 타입 검증 없음 | `apps/api/src/medical-expense/medical-expense.routes.ts:31` | `multer`가 20MB 크기 제한만, `fileFilter` 없음. 실행 파일 포함 모든 확장자 허용. |
| M8 | `SECURITY_LEVEL=INTERNAL` 의료 보고서가 모든 COACHING_STAFF에 노출 | `apps/api/src/injury/injury.service.ts:149` | `getReport()`가 `PRIVATE` 게이트만 강제. `INTERNAL`·`MEDICAL` 보안 수준 구분 없음. |
| M9 | `InjuryAssessment`가 단일 upsert — 이력 없음 | `apps/api/src/injury/injury.repo.ts:260` | `upsertAssessment()`가 단일 행을 덮어씀. 연속 복귀 평가가 서로를 교체, 종단 이력 없음. |
| M10 | 의료비 `costCategory`·`totalAmount`가 임의값 허용 | `apps/api/src/medical-expense/medical-expense.controller.ts:54` | `costCategory`가 raw `string as any`, `totalAmount`에 범위 체크 없음. 잘못된 데이터가 2단계 승인 통과. |

### Kane (Technical Director 컨디셔닝, 영국, 15년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| K1 | ACWR 만성 윈도우가 급성 기간 포함 — 더블카운팅 | `apps/api/src/training-load/training-load.service.ts:158-164` | `getLoadsBetween(chronicStart, now)`가 28일 전체 조회, 급성 7일이 만성 분모에 포함되어 급성 급등 시 위험 신호 억제. |
| K2 | `load` 필드에 단위 정규화 없음 — 이질적 단위 단순 합산 | `apps/api/src/training-load/dto/training-load.dto.ts:1-9` | `KG`, `MINUTES`, `DISTANCE_M`, `SETS`를 plain 정수로 합산. 5km 달리기(5000)와 5세트 근력(5) 합산은 과학적으로 무의미. |
| K3 | sRPE 계산 불가 — 세션 시간 미저장 | `apps/api/prisma/schema.prisma:1417-1441` | `TrainingSession`에 `durationMinutes` 없음. 표준 sRPE = RPE × duration 계산 불가. |
| K4 | 활성 부상 시 부하 기록이 fire-and-forget | `apps/api/src/training-load/training-load.service.ts:60-64` | 부상 확인이 `console.warn`만 출력하고 계속 저장. `rehabLoadPercentage` 미확인. |
| K5 | 주간 과부하 임계치에 일중 급등 탐지 없음 | `apps/api/src/training-load/training-load.service.ts:68-103` | 주간 누적 합계만 체크, 단일 세션 급등 미탐지. 주중 재앙적 단일 세션 과부하 불가시. |
| K6 | RPE가 `Int`로 저장 — Borg 소수 값 손실 | `apps/api/prisma/schema.prisma:1983` | `TrainingLoad.rpe`가 `Int`, 6.5·7.5 등 반값 잘림. `rpe >= 1` 검증이지만 0(휴식)도 유효 RPE. |
| K7 | 부상 모델에 조직 유형·등급·접촉 여부 없음 | `apps/api/prisma/schema.prisma:1186-1211` | 근육/힘줄/인대, Grade I/II/III, 접촉/비접촉 모두 없음. 부상 역학의 3대 변수 전부 미포함. |
| K8 | 성장 궤적이 주관적 `performanceScore`를 신체 부하 대리 지표로 사용 | `apps/api/src/training-load/training-load.repo.ts:103-131` | 측정 프로토콜 없는 코치 주관 정수를 컨디셔닝 궤적으로 사용. |
| K9 | 세션 계획에 경기 일정 인식 없음 | `apps/api/prisma/schema.prisma:1417-1441` | `TrainingSession`에 `Match` 연결·`daysToNextMatch` 없음. 경기 48h 내 PHYSICAL 세션 제한 강제 불가. |
| K10 | 이상 탐지가 고정 산술 참조값 사용 — 개인 기준선 없음 | `apps/api/src/training-load/training-load.service.ts:137-151` | `load >= threshold * 0.14` — 전 선수에 70 AU 하드코딩. 포지션·세션 유형·개인 기준선 미반영. |

### 박희수 (의무팀, 한국, 15년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| BH1 | 부상 중증도 척도·근육군 세분화 없음 | `apps/api/prisma/schema.prisma:1186` | `Injury` 모델이 10개 값의 거친 `BodyPart` enum만 있고 중증도·좌우·근육군 세부 없음. |
| BH2 | 단일 스냅샷 평가 — 이력 없음 | `apps/api/prisma/schema.prisma:1213` | `InjuryAssessment`가 `injuryId`에 `@unique` 1:1. 모든 `processAssessment`가 이전 기록 덮어씀. 재활 진척 데이터 영구 소실. |
| BH3 | 부상 선수가 재활 유형 무관 ABSENT_AUTHORIZED로 자동 마킹 | `apps/api/src/training/training.repo.ts:106` | 수영 재활 중인 선수도 완전 불가 선수와 동일 상태. 부분 훈련 출석 기록 불가. |
| BH4 | 부상 종료 시 선수 가용 상태 미자동 업데이트 | `apps/api/src/injury/injury.service.ts:103` | `RETURNED` 전환 시 `Player.status` 업데이트 없음. 코칭 스태프가 복귀 전후 모두 "ACTIVE"로 봄. |
| BH5 | `matchAvailable=true` 경고가 비차단적이고 미지속 | `apps/api/src/injury/injury.service.ts:171` | `_warning` 필드를 반환하지만 persist 없음. 페이지 새로고침 시 경고 소멸. |
| BH6 | 치료 로그 없음 — `treatmentContent`가 덮어쓰기 단일 텍스트 | `apps/api/prisma/schema.prisma:1773` | 저장마다 이전 내용 교체. 날짜별 치료 항목 로그 불가. |
| BH7 | 훈련 부하 활성 부상 경고가 fire-and-forget | `apps/api/src/training-load/training-load.service.ts:60` | `void ... .then(...)` 형태, `console.warn`만 출력하고 저장 계속. 부상 중 기록된 부하 항목 조회 불가. |
| BH8 | `InjuryCause`가 3개 값뿐 — 접촉/비접촉·과사용 구분 없음 | `apps/api/prisma/schema.prisma:172` | `TRAINING | MATCH | OTHER`. 접촉 파울·비접촉 근육 파열·만성 과사용 부상 구분 불가. |
| BH9 | `rehabLoadPercentage`가 날짜 색인 없는 단일 Int | `apps/api/prisma/schema.prisma:1781` | 복귀 준비 체크리스트가 단일 upsert 값 사용, 주간 진척 이력 없음. |
| BH10 | 의료비에 치료 유형·세션 날짜 필수 연결 없음 | `apps/api/prisma/schema.prisma:1718` | `MedicalExpense`에 별도 `treatmentDate`·재활 세션 연결 없음, `description` 선택 사항. 부상별 비용 분석 불가. |

---

## 섹션 6: 스폰서십 · 파트너십

### 빠뜨롱 (자산관리사, 한국, 15년차, T형) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| P1 | `SponsorshipClause`·`SponsorshipExposureEvent`에 API 없음 | `apps/api/src/sponsorship/` (clause/, exposure/ 서브디렉토리 없음) | 스키마에 모델 존재(3530-3564행)하나 서비스·컨트롤러·라우트 코드 없음. 완전 미구현. |
| P2 | `contactFollowUpNotifier` 잡이 `server.ts`에 등록 안 됨 | `apps/api/src/server.ts:77-101` | `startContactFollowUpNotifierJob()` 구현됐지만 import·호출 없음. 일일 08:00 팔로업 알림 크론이 silent dead. |
| P3 | `markPaid`가 스폰서십 통화 무관 항상 KRW 원장 기록 | `apps/api/src/sponsorship/sponsorship.service.ts:127-137` | `currency: "KRW"`, `exchangeRate: 1` 하드코딩. 해외 스폰서 결제가 원장 오염. |
| P4 | ROI 요약이 다통화를 정규화 없이 합산 | `apps/api/src/sponsorship/sponsorship.repo.ts:150-196` | `getRoiSummary()`가 `currency` 없이 Decimal 합산. £50만과 ₩5억이 동등하게 더해짐. |
| P5 | 결제 스케줄 재계산 시 PAID 결제를 삭제해 원장 이중 계상 | `apps/api/src/sponsorship/sponsorship.repo.ts:128-131` | `deletePayments()`가 `status: "PENDING"`만 필터, PAID 행 생존. 새 할부가 전체 `totalFee` 기준으로 재계산. |
| P6 | `getPayments` 핸들러에 인증·인가 체크 없음 | `apps/api/src/sponsorship/sponsorship.controller.ts:65-69` | 다른 핸들러는 `requireUser`·`canRead`/`canWrite` 체크. `getPayments`만 둘 다 생략, 비인증 접근 가능. |
| P7 | EQUIPMENT_MANAGER가 파트너 연락 로그 작성 가능 — 역할 경계 위반 | `apps/api/src/partner/contact-log/contact-log.controller.ts:11-12` | `canManage`가 `FRONT_OFFICE + EQUIPMENT_MANAGER`에 쓰기 권한 부여. 장비 관리자가 CRM 기록 생성 가능. |
| P8 | 노출 이벤트 데이터가 ROI 스칼라에 집계 안 됨 | `apps/api/src/sponsorship/sponsorship.repo.ts:143-145,162-169` | ROI 요약이 `Sponsorship` 기존 스칼라 컬럼만 읽음. 새 `SponsorshipExposureEvent` 행 집계 없음. ROI 대시보드 항상 부실. |
| P9 | 파트너 티어 변경에 감사 로그 없고 `tierReason` 필수 아님 | `apps/api/src/partner/partner.service.ts:26-34` | 이유 삭제 체크는 있으나 업그레이드·다운그레이드 시 `tierReason` 필수 아님. `writeAuditLog` 미존재. |
| P10 | `contactedAt`이 미래 타임스탬프 허용 | `apps/api/src/partner/contact-log/contact-log.service.ts:18-25` | `nextActionDate` 커플링은 검증하지만 `contactedAt` 미래값 체크 없음. 2030년 로그가 CRM 이력 최상단 영구 점령. |

---

## 섹션 7: 시설 관리 · 장비 관리

### 김동욱 (시설관리팀장, 한국, 18년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| KD1 | `transitionUnitStatus`가 고가 장비 폐기 검증 우회 | `apps/api/src/equipment/equipment.service.ts:101` | `EquipmentDisposalVerification` 존재 여부·`isHighValue` GM 승인 필요 여부 확인 없이 직접 폐기 가능. |
| KD2 | SLA 필드 저장되나 강제 적용 없음 | `apps/api/src/facility/maintenance/maintenance.service.ts` | `PartnerContract`에 `responseHours`·`resolutionDays`·`penaltyPerDay` 있으나 위반 탐지·패널티 계산 코드 없음. |
| KD3 | 예방 정비 크론이 `facilityZone` 없는 `MaintenanceRequest` 생성 | `apps/api/src/jobs/preventiveScheduleGen.ts:42` | 자동 생성 잡이 `schedule.facilityZone`을 create 호출에 미전달. 자동 생성 티켓 전부 zone 없음. |
| KD4 | `submitToFinance`가 `estimatedCost` 사용, 상태 가드 없음 | `apps/api/src/facility/maintenance/maintenance.service.ts:132` | 재무 제출이 추정 비용 기준이나 원장 분개는 `actualCost` 기준. OPEN·IN_PROGRESS 상태에서도 제출 가능. |
| KD5 ✅ | `canAccessZone`이 `frontOfficeRole` 무시 | `apps/api/src/lib/facilityAccessControl.ts:6` | 구역 접근 규칙이 `role` 문자열만 키. 모든 `FRONT_OFFICE` 사용자가 `FACILITY_MANAGER`와 동일 권한. |
| KD6 | `MEDICAL_STAFF`·물리치료사가 `MEDICAL_ROOM` 접근 차단 | `apps/api/src/lib/facilityAccessControl.ts:13` | `MEDICAL_ROOM`이 `ADMIN`, `SUPER_ADMIN`, `GM`, `COACHING_STAFF`만 허용. 의료 frontOfficeRole 보유자 차단. |
| KD7 | 접근 로그 조회가 200행 하드캡, 페이지네이션 없음 | `apps/api/src/facility/access-log/access-log.repo.ts:33` | `findAll`이 항상 `take: 200` 적용. 훈련일 200건 초과 시 보안 감사가 잘린 로그만 수신. |
| KD8 | 정액 감가상각이 30일 고정 월 사용 | `apps/api/src/equipment/equipment.service.ts:88` | `elapsedMonths = Math.floor(elapsedMs / (1000 * 60 * 60 * 24 * 30))` 5년 자산 수명 동안 ~18일 드리프트. 잔존 가치 하한 없어 `newBookValue`가 음수 가능. |
| KD9 | `PreventiveSchedule` `intervalDays` 수정 시 `lastGeneratedAt` 미리셋 | `apps/api/src/facility/preventive-schedule/preventive-schedule.repo.ts:40` | 일정 단축 시 `lastGeneratedAt` 초기화 없어 다음 생성이 잘못된 기준에서 발화. |
| KD10 | 폐기 거절이 FM 기존 점검 노트를 덮어씀 | `apps/api/src/equipment/disposal/disposal.repo.ts:65` | `rejectVerification`이 `{ status: "REJECTED", notes: reason }`으로 `notes` 무조건 교체. 별도 `rejectionReason` 컬럼 없음. |

### Trevor (Stadium Operations Manager, 영국, 14년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| T1 | SLA 위반 탐지·자동 패널티 계산 없음 | `apps/api/src/facility/maintenance/maintenance.service.ts:38` | `PartnerContract` SLA 필드 저장되나 경과 시간 체크·위반 알림·패널티 누적 코드 없음. |
| T2 | 유지보수 벤더 계약 만료 알림 잡 없음 | `apps/api/src/jobs/` (없음) | 선수 계약·스폰서십엔 90/60/30일 크론 경보가 있으나 `PartnerContract`엔 없음. 계약 만료 시 법적 보장 없는 서비스 제공자 위험. |
| T3 | 법정 점검 마감이 `console.warn`만 기록 | `apps/api/src/facility/inspection/inspection.controller.ts:44` | `isStatutory=true`이고 30일 내 마감이면 `console.warn()`만 호출. 알림 생성·FM 경보·기한 초과 추적 잡 없음. |
| T4 | 시설 재고 항목에 구역 연결 없음 | `apps/api/src/inventory/inventory.repo.ts:1` | `FacilityInventoryItem`에 `facilityZone` 없음. 모든 소모품이 단일 풀로 추적. 구역별 예산 분산 보고 구조적 불가. |
| T5 ✅ | 구역 접근 제어가 `frontOfficeRole` 무시 — 모든 FRONT_OFFICE가 제한 구역 진입 | `apps/api/src/lib/facilityAccessControl.ts:6` | `ZONE_ACCESS_RULES`가 `FRONT_OFFICE`에 MECHANICAL·STRUCTURAL·SAFETY·SANITATION·OPERATIONS 일괄 부여. 티켓팅 직원이 보일러실 접근 가능. |
| T6 | 시설 예약 중복·충돌 체크 없음 — 동일 구역 이중 예약 가능 | `apps/api/src/facility/reservation/reservation.controller.ts:19` | `create`가 `startTime < endTime`만 검증. 동일 `facilityZone` 중첩 시간 예약 쿼리 없음. |
| T7 | 사후 사고 보고서(PIR)가 선택 사항 — `RESOLVED` 전 강제 없음 | `apps/api/src/facility/maintenance/maintenance.service.ts:75` | `gmApprove()`가 `postIncidentReport` 작성 검증 없이 해결. HSE는 EMERGENCY 우선순위 사고의 서면 PIR을 요구. |
| T8 | 소프트웨어 라이선스 만료 경보가 30일 단일 임계치, 갱신 워크플로우·사용자 매핑 없음 | `apps/api/src/jobs/equipmentExpiryAlert.ts:15` | 90/60일 마일스톤 없음. `assign()`이 `usedSeats` 증가하지만 `_userId` 파라미터 폐기, 사용자-라이선스 매핑 없음. |
| T9 | 접근 로그 조회가 200행 하드캡, 페이지네이션 없음 | `apps/api/src/facility/access-log/access-log.repo.ts:33` | 경기 당일 수천 건 접근 이벤트 발생 가능. 보안 감사가 잘린 로그만 수신. 사고 후 포렌식 검토 실패. |
| T10 | 긴급 정비 알림이 "전 스태프" 대상, 에스컬레이션 경로 없음 | `apps/api/src/notification/notification.service.ts:131` | `notifyFacilityEmergency()`가 전 스태프에 브로드캐스트, 경기장 안전 책임자 개념·에스컬레이션 타임아웃 없음. |

---

## 섹션 8: 채용 · 인재 파이프라인

### 서지혜 (채용팀장, 한국, 11년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| SJ1 | ROUND_1 통과 없이 ROUND_2 인터뷰 일정 가능 | `apps/api/src/recruitment/recruitment.service.ts:146` | `scheduleInterview()`가 `ROUND_2` 요청 시 기존 `ROUND_1` `result === "PASS"` 확인 없음. |
| SJ2 | 직접 지원자 중복 신청 허용 | `apps/api/prisma/schema.prisma:2595` | `@@unique([postingId, externalApplicantId])`가 `externalApplicantId` 없는 직접 지원자에 미적용. |
| SJ3 | OTP가 `'000000'`으로 하드코딩 | `football/src/pages/admin/recruitment/ApplicationDetailPage.tsx:217` | "수동 인증" 버튼이 `recruitmentApi.verifyEmail(appId, '000000')` 호출 — 보안 안티패턴 하드코딩. |
| SJ4 | `completeMfa`·`verifyEmail` 엔드포인트에 auth 미들웨어 없음 | `apps/api/src/recruitment/recruitment.routes.ts:55-56` | 비인증 호출자가 임의 `applicationId`로 온보딩 완료·`StaffRecord` 자동 생성 트리거 가능. |
| SJ5 | `employeeId`가 `applicationId` 문자열 변환값 | `apps/api/src/recruitment/recruitment.service.ts:250` | MFA 완료 시 `StaffRecord`가 `employeeId: String(applicationId)` 생성. 기존 직원 ID와 충돌 가능. |
| SJ6 | 오퍼 수락/거절 상태 없음 — 수락률 계산 불가 | `apps/api/src/recruitment/recruitment.service.ts:125` | `OFFER_DECLINED` 상태·`acceptedAt`/`declinedAt` 타임스탬프·공식 수락/거절 엔드포인트 없음. |
| SJ7 | 채용 소요 시간이 `createdAt`→`offeredAt` 측정, 실제 온보딩 제외 | `apps/api/src/recruitment/recruitment.repo.ts:307` | 오퍼-수락 간격·온보딩 지연 제외. 실제 time-to-hire 과소 측정. |
| SJ8 | 파이프라인 퍼널·단계 전환 분석 엔드포인트 없음 | `apps/api/src/recruitment/recruitment.routes.ts` | APPLIED→SCREENING→INTERVIEW_1→...→ONBOARDED 단계별 지원자 수 집계 엔드포인트 없음. |
| SJ9 | 인터뷰 일정 확정 시 지원자 알림 없음 | `apps/api/src/recruitment/recruitment.service.ts:155-165` | `scheduleInterview()`가 면접관에게만 알림, 후보자에게 이메일·알림 없음. |
| SJ10 | 공고 마감 시 진행 중 지원서 상태 처리 없음 | `apps/api/src/recruitment/recruitment.service.ts:72-76` | `closePosting()`이 공고 상태만 `CLOSED`로 변경. `APPLIED`·`SCREENING` 지원서 silent 고립. |

### Claire (Talent Acquisition Director, 영국, 9년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| C1 | 국제 후보 숏리스팅 전 취업 비자 사전 평가 게이트 없음 | `apps/api/src/prospect/prospect.repo.ts:22-28` | `ACTIVE→MEDICAL_TEST` 전환 시 `visaRequired`/`visaEligibility` 확인 없음. 비자 불확실 후보가 의료 검사·계약 단계 진입 가능. |
| C2 | 에이전시에 FIFA 중개인 규정 준수 필드 없음 | `apps/api/src/agency/agency.service.ts:17-18` | `licenseNumber`·`licenseExpiryDate`·`licensingBody`·`isActive` 없음. FIFA IFR 준수 검증 불가. |
| C3 | 에이전시 수수료율이 FIFA/KFA 상한 미검증 | `apps/api/src/agency/agency.service.ts:22` | `commissionRate`에 최대값 없음. FIFA 3% 상한 초과 계약 시스템 수준 거부 없음. |
| C4 | 지원서 거절 시 사유 미캡처 | `apps/api/src/recruitment/recruitment.service.ts:106-116` | `rejectApplication()`이 `reason` 인수 없음, `rejectionReason: null` 하드코딩. GDPR/PIPA 기회균등 준수 미흡. |
| C5 | 면접관 점수에 중복 제출 가드 없음 | `apps/api/src/recruitment/recruitment.repo.ts:335-348` | `addInterviewerScore()`가 `(interviewId, interviewerId)` unique 체크 없이 `create()`. 동일 면접관이 무제한 점수 제출 가능. |
| C6 | 인터뷰 점수 차원에 범위 검증 없음 | `apps/api/src/recruitment/recruitment.service.ts:274-276` | `scoreSkill`·`scoreComm`·`scoreCulture`가 범위 체크 없이 Prisma 전달. `scoreSkill: 999` 허용. |
| C7 | `CreateJobApplicationDto`에 국적·국제 지원자 플래그 없음 | `apps/api/src/recruitment/dto/recruitment.dto.ts:30-36` | 국내/국제 지원자 파이프라인 필터링 불가. |
| C8 | `getTimeToHireStats()`가 `offeredAt`→실제 시작일 측정 안 함 | `apps/api/src/recruitment/recruitment.repo.ts:300-311` | 국제 채용의 취업비자 처리 기간(4-12주) 미포함. `startDate`·`joinedAt` 필드 없음. |
| C9 | 이적 확정 시 FIFA TMS·ITC 참조 없음 | `apps/api/src/transfer-request/transfer-request.repo.ts:138-178` | `confirm()`이 ITC 필드·TMS 트랜잭션 ID·이적 창 날짜 체크 없이 `Transfer` 행 생성. FIFA RSTP 9조 위반. |
| C10 | 채용 자동화 준수 체크가 의료 스태프를 코칭 카운트에 이중 계산 | `apps/api/src/hiring-automation/hiring-automation.repo.ts:145-151` | `checkAutoCompliance()`가 `COACHING_STAFF`를 `coachingCount`에, 의료 서브롤을 `medicalCount`에 중복 계산. 실제 코칭 인원 과대 보고. |

---

## 섹션 9: 팬 운영 · 티켓

### 박성준 (팬서비스팀장, 한국, 8년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| PS1 | 판매 채널별 분석 없음 | `apps/api/src/sales/sales.repo.ts:46` | `groupByType()`이 티켓 유형별 집계만. ONLINE/ONSITE/PARTNER/SEASON_PASS 채널별 분석 엔드포인트 없음. |
| PS2 | `findWithFilters`가 취소·환불 레코드 포함 | `apps/api/src/sales/sales.repo.ts:135` | `deletedAt: null` 가드 없어 취소된 레코드 반환, 합계·내보내기 데이터 부풀림. |
| PS3 | `FanPurchase` 모델이 dead stub — `SalesRecord`와 연결 안 됨 | `apps/api/src/sales/fan/fan.repo.ts:1` | `SalesRecord.create()`가 `FanPurchase` 행을 절대 작성하지 않음. 팬 충성도 분석 완전 불가. |
| PS4 | 팬 충성도 포인트·티어 자동 승급 없음 | `apps/api/src/sales/fan/fan.controller.ts:35` | `FanMembership`에 BRONZE→SILVER→GOLD→PLATINUM 티어 있으나 포인트 필드·자동 승급 없음. 수동 배정. |
| PS5 | `LINEUP_CONFIRMED` 알림에 딥링크 경로 없음 | `football/src/services/notification.service.ts:13` | `NOTIFICATION_ROUTES`가 40+ 타입 매핑하나 `LINEUP_CONFIRMED` 누락. 알림 클릭 시 아무 동작 없음. |
| PS6 | 경기 당일 알림이 스쿼드 선수에게만 — 팬 회원 제외 | `apps/api/src/jobs/matchDayNotification.ts:18` | `startMatchDayNotificationJob`이 경기 스쿼드 선수만 조회. 등록 팬 회원 홈경기 알림 없음. |
| PS7 | 학부모 포털에 경기 일정 탭 없음 — API 데이터 미사용 | `football/src/pages/youth/GuardianPortalPage.tsx:77` | 백엔드 `getDashboard()`가 `upcoming.matches` 반환하나 프론트가 렌더링 안 함. |
| PS8 | 아카데미 비용 승인 알림이 잘못된 타입 발송 | `apps/api/src/academy-fee/academy-fee.service.ts:136` | `approvePayment()`·`confirmTossPayment()`가 결제 확인 후에도 `"FEE_INVOICE_ISSUED"` 발송. `FEE_PAYMENT_CONFIRMED` 미발송. |
| PS9 | TicketSalesPage 경기 요약이 5경기 하드캡 | `football/src/pages/finance/TicketSalesPage.tsx:43` | `RECENT_MATCHES = 5` 상수로 최근 5경기 고정. 전체 보기 토글·페이지네이션·내보내기 없음. |
| PS10 | 실제 입장 인원 필드 없음 — `capacity`·`soldCount` 조정 불가 | `apps/api/src/sales/sales.service.ts:57` | 실제 회전문 통과 인원 기록 필드 전무. 평균 실입장·노쇼율·수용 대비 트렌드 계산 불가. |

### Jordan (Head of Ticketing & Fan Engagement, 영국, 16년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| J1 | `findByMatch`가 VIP·COMPLIMENTARY·REFUNDED 판매 silent drop | `apps/api/src/sales/sales.repo.ts:16` | `type: "TICKET"`만 필터. VIP_TICKET·COMPLIMENTARY 레코드 재무 뷰에 불가시. |
| J2 ✅ | `cancel` 엔드포인트에 인가 가드 없음 | `apps/api/src/sales/sales.controller.ts:120-128` | `req.user!.id` 사용하나 `requireUser()`·권한 체크 없음. 모든 인증 세션이 취소 레코드 생성 가능. |
| J3 | 취소 레코드가 `refundedFromId` 미연결 | `apps/api/src/sales/sales.service.ts:372-394` | `createCancellation`이 `status: CANCELLED`인 새 `SalesRecord`를 `refundedFromId` 없이 생성. 어떤 판매에 대한 환불인지 조정 불가. |
| J4 | `delete`가 원장 분개를 hard remove | `apps/api/src/sales/sales.service.ts:318-319` | `tx.ledgerEntry.deleteMany()`가 수입 분개 물리 삭제. 감사 추적 소멸, 기간별 수익 소급 변경. |
| J5 | `sellRate`이 `totalSold` 분모에 무료 티켓 포함 | `apps/api/src/sales/sales.repo.ts:86` | `complimentaryQty`가 `netSold`에 포함. 유료 판매율 과장. |
| J6 | `ticketSummaryByMatch`에 구역별 수익 분류 없음 | `apps/api/src/sales/sales.repo.ts:53-105` | 모든 구역이 단일 `totalAmount` 합산. 기업 박스·테라스·패밀리 스탠드 가격 tier 분석 완전 불가. |
| J7 | `SeatZone.soldCount`가 삭제 시 음수 가능 | `apps/api/src/sales/sales.service.ts:329-333` | 감소 시 `soldCount >= existing.quantity` 확인 없음. 이중 삭제 시 `soldCount` 음수, 용량 체크 오염. |
| J8 | 경기별 매출 예측 대비 실적 갭 미산출 | `apps/api/src/financial-report/financial-report.service.ts:229-360` | `getPnL`이 시즌 수준 비교만 제공. 경기별 예측 입장 수입 필드 없음. |
| J9 | `FanPurchase`가 `SalesRecord`와 단절 — 이중 수익 원장 문제 | `apps/api/prisma/schema.prisma:3115-3132` | `FanPurchase`가 자체 `totalAmount` 기록하나 `SalesRecord` FK 없음. 팬 구매 수익이 모든 재무 보고서·P&L에 불가시. |
| J10 | `update` 시 `totalAmount` 재계산하나 수용 인원 미확인 | `apps/api/src/sales/sales.service.ts:261-303` | `quantity` 상향 수정 시 용량 체크 미재실행. 500→5000 수정 시 `MATCH_CAPACITY_EXCEEDED` 미발동. |

---

## 섹션 10: IT · 데이터 보안

### 이상훈 (IT보안팀장, 한국, 13년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| IS1 | 로그인 엔드포인트에 rate limiting 없음 | `apps/api/src/auth/auth.routes.ts:17` | `POST /auth/login`에 rate-limit 미들웨어 없음. 무제한 속도 브루트포스 가능. KISA 가이드라인 위반. |
| IS2 | JWT 인증 쿠키에 `secure` 플래그 없음 | `apps/api/src/lib/constants.ts:25-26` | `httpOnly`·`sameSite` 설정되나 `secure: true` 누락. HTTP 평문 토큰 전송 가능. |
| IS3 | CORS origin이 `PORT` 값으로 하드코딩 | `apps/api/src/app.ts:15` | `origin: PORT ?? "http://localhost:5175"`가 포트 번호 문자열(예: `"5000"`)로 설정. 실제 브라우저 origin과 매칭 불가. |
| IS4 | 급여 `list`·`get` 엔드포인트에 읽기 권한 체크 없음 | `apps/api/src/payroll/salary/salary.controller.ts:11-20` | 모든 인증 사용자(PLAYER, AGENT, GUARDIAN)가 전체 급여 레코드 열람 가능. |
| IS5 | 급여 수당 `list` 엔드포인트가 전 인증 역할에 노출 | `apps/api/src/payroll/allowance/allowance.controller.ts:11-14` | `AllowanceController.list`에 인가 가드 없음. 금액·유형·스케줄 포함 개인 수당 행 열람 가능. |
| IS6 | 채용 온보딩 단계에 auth 없음 — MFA 우회 위험 | `apps/api/src/recruitment/recruitment.routes.ts:55-56` | `verify-email`·`complete-mfa` 엔드포인트가 `auth` 미들웨어 없이 등록. 비인증 호출자가 임의 지원자 온보딩 완료 가능. |
| IS7 | `canReadActiveInjury`가 모든 COACHING_STAFF 서브롤에 민감 의료 PII 허용 | `apps/api/src/lib/permissions.ts:64-67` | `coachingRole` 무관 `role === 'COACHING_STAFF'` 전체가 활성 부상 기록 접근. VIDEO_ANALYST·PHYSICAL_COACH가 GDPR 9조 특별 범주 데이터 접근. |
| IS8 | 관리자 `listUsers`가 `isDemo` 플래그 미전달 — PII 마스킹 비활성 | `apps/api/src/admin/admin.controller.ts:20-31` | `AdminController.listUsers`가 `isDemo` 인수 없이 `listUsers(filters)` 호출. `maskEmail`·`maskUsername` 미발동. |
| IS9 | `getMatchStats`·`getPositionDiversity`·`getRadar`에 인가 가드 없음 | `apps/api/src/player/player.controller.ts:191-220` | 상세 성과 통계 엔드포인트에 역할 체크 없음. AGENT·GUARDIAN이 임의 선수 레이더 차트·통계 열람 가능. |
| IS10 | HTTP 보안 헤더 없음(helmet 미사용); 에러 핸들러가 raw 스택 트레이스 유출 | `apps/api/src/app.ts:1-23` / `apps/api/src/middleWare/ErrorHandler.ts:10` | 보안 헤더 미들웨어 없음(CSP/HSTS 없음). `ErrorHandler.ts`가 `console.error(err)` 전체 스택 트레이스 출력. KISA 가이드라인 §6.2 미적용. |

### Rachel (Head of Information Security, 영국, 11년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| RC1 | GDPR 삭제 시 암호화된 전화번호가 고아로 잔존 | `apps/api/src/auth/auth.repo.ts:165` | `anonymizeUser()`가 `User` 행만 덮어쓰고 연결된 `PhoneNumber` 레코드 미삭제. 암호화 전화 blob 무기한 잔존. UK GDPR 17조 위반. |
| RC2 | 의료 특별 범주 데이터(9조)가 암호화 없이 저장 | `apps/api/src/injury/injury.repo.ts:22-33` | `diagnosisName`·`treatmentContent`·`medicalOpinion`·`reinjuryRisk`·`allowedActivities`가 평문 저장. 필드 수준 암호화 없음. |
| RC3 | 보존 잡이 플래그만 설정, 실제 삭제 없음 | `apps/api/src/jobs/rejectedApplicantRetention.ts:12` | 두 크론이 `dataRetentionFlaggedAt` 설정만, `deleteMany`·익명화 없음. UK GDPR 5(1)(e)조 미준수. |
| RC4 | 선수 이름이 감사 로그 `detail` 필드에 유출 | `apps/api/src/injury/injury.service.ts:249` | `writeAuditLog`가 `{ playerName: ... }` 전달, `SENSITIVE_KEYS`에 `playerName` 미포함. 개인 식별 정보를 의료 이벤트와 연결. GDPR 최소화 원칙 위반. |
| RC5 | 로그인 이력이 IP 주소를 보존 기간 제한 없이 저장 | `apps/api/src/auth/auth.repo.ts:51-57` | IP 주소를 `LoginHistory`에 TTL·삭제 크론·최대 보관 기간 없이 평문 기록. GDPR 5(1)(e)조 위반. |
| RC6 | 부상 평가 엔드포인트에 역할 기반 접근 제어 없음 | `apps/api/src/injury/injury.routes.ts:67-68` | `GET /:id/assessment`·`PUT /:id/assessment`가 유효한 JWT만 확인. PLAYER·AGENT·GUARDIAN이 통증 수준·ROM 점수·심리 점수 열람·수정 가능. |
| RC7 | 레퍼런스 체크 동의가 opt-out 모델 — 명시적 opt-in 아님 | `apps/api/src/recruitment/recruitment.service.ts:193-195` | `if (referenceCheckConsent === false)` — `null`/`undefined`를 동의로 처리. UK GDPR 7조: 침묵은 유효한 동의 아님. |
| RC8 | GDPR 데이터 내보내기에 부상 보고서(진단·치료·의료 의견) 누락 | `apps/api/src/auth/auth.repo.ts:200-203` | `exportUserData()`가 `injuryReport` 관계 완전 제외. UK GDPR 15조 직접 위반. |
| RC9 | 학부모 부상 이메일이 동의 게이트 없이 의료 원인 노출 | `apps/api/src/lib/email.ts:28-43` | `sendGuardianInjuryEmail()`이 `dto.cause`를 이메일 본문에 포함. 성인 선수의 경우 제3자(학부모)에게 건강 데이터 공개 GDPR 9(2)조 위반. |
| RC10 | 외부 국가 API 호출이 DPA 없는 제3자 데이터 이전 위험 | `apps/api/src/externalAPI.ts:5` | `CountryApiClient`가 EEA 외부 `https://restcountries.com/v3.1/` 호출. DPA·적정성 평가·SCC 없음. UK GDPR 44-49조 위반. |

---

## 섹션 11: 유소년 · 학부모

### 정훈 (유소년 HEAD_COACH, 한국) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| JH1 | 유소년 등록 create·reject·contract에 역할 가드 없음 | `apps/api/src/youth-registration/youth-registration.controller.ts:27-73` | `create`·`reject`·`contract`가 `auth`만 체크. PLAYER·AGENT가 유소년 등록 제출·계약 완료 가능. |
| JH2 | 학부모 계정 생성 후 자격증명 미통보 | `apps/api/src/youth-registration/youth-registration.routes.ts:19-42` | `inviteAdapter.inviteUser`가 임시 비밀번호로 계정 생성 후 이메일 미발송. 학부모가 로그인 불가, 등록이 `PENDING`에서 silent stall. |
| JH3 | 신규 선수 계약 시 HEAD_COACH 알림 없음 | `apps/api/src/youth-registration/youth-registration.service.ts:78-92` | `contract()`가 학부모에게만 알림, `createForYouthHeadCoach()` 호출 없음. |
| JH4 | 콜업 거절·완료 시 학부모 알림 없음 | `apps/api/src/player-callup/player-callup.service.ts:145-167,206-219` | `reject()`가 요청자만 알림. `complete()`가 누구에게도 알림 없음. |
| JH5 | 훈련 부하 임계치가 성인 기준 — 유소년 미분류 | `apps/api/src/training-load/training-load.service.ts:7-27` | `WEEKLY_LOAD_THRESHOLD`가 포지션 기준이나 선수 레벨 미분류. U-18 CM이 시니어 CM과 동일 540 단위 임계치. |
| JH6 | 성장 평가 점수에 범위 검증 없음 | `apps/api/src/growth-report/growth-report.controller.ts:28-39` | null 체크만, 상하한 없음. `-5`·`999` 점수 허용, 포지션 평균 비교 오염. |
| JH7 | `updateSession`·`cancelSession`이 라우트 미등록 — 도달 불가 | `apps/api/src/training/training.routes.ts:15-26` | 두 메서드 모두 학부모 알림 로직 포함하나 컨트롤러·라우트에 미노출. 코치가 세션 수정·취소 불가. |
| JH8 | `PlayerDevelopmentPlan.goals`가 단일 텍스트 blob | `apps/api/prisma/schema.prisma:2001` | 마일스톤·목표 지표·기한·진척 추적 필드 없음. 정량 발달 목표 기록 불가. |
| JH9 | `getSessions`가 `teamId` 필터 미노출 — 전 팀 세션 반환 | `apps/api/src/training/training.controller.ts:13-19` | `req.query`에서 `seasonId`만 수집, `teamId` 미전달. 모든 코칭 스태프가 전 팀 세션 조회. |
| JH10 | 세이프가드 보고서가 HEAD_COACH 접근 불가 — 신고자가 진행상황 추적 불가 | `apps/api/src/safeguard/safeguard.routes.ts:35-37` | `GET /safeguard`·`GET /safeguard/:id`가 `adminOnly` 요구. 신고한 HEAD_COACH가 자신의 신고 상태 확인 불가. |

### 이승희 (학부모/Guardian, 한국) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| LS1 | 성장평가·발달계획 탭 미존재 | `football/src/pages/youth/GuardianPortalPage.tsx:77-82` | 대시보드 API가 `growth.latestEvaluation`·`growth.activeDevelopmentPlan` 반환하나 포털 탭이 4개뿐, UI 미렌더링. |
| LS2 | 훈련 피드백·퍼포먼스 점수 비공개 | `apps/api/src/guardian/guardian.repo.ts:105-112` | 출결 탭이 날짜·출결 상태만 보여주고 코치 입력 `feedback`·`performanceScore` 미반환. |
| LS3 | 취소된 훈련이 "예정" 목록에 표시 | `apps/api/src/guardian/guardian.repo.ts:104-112` | "다음 7일 훈련" 쿼리에 `cancelledAt: null` 조건 없음. 취소 세션이 올라옴. |
| LS4 | 새 훈련 일정 등록 시 학부모 알림 없음 | `apps/api/src/training/training.service.ts:35-55` | 새 세션 생성 시 코치에게만 알림, `createForGuardian` 호출 없음. |
| LS5 | 콜업 거절·완료 시 학부모 알림 없음 | `apps/api/src/player-callup/player-callup.service.ts:144-166,206-218` | `reject()`가 요청자(코치)에게만 알림. `complete()`에 `createForGuardian` 없음. |
| LS6 | 발달계획 활성화 시 학부모 알림 없음 | `apps/api/src/development-plan/development-plan.service.ts:43-58` | `activate()`가 선수 `userId`에게만 알림, `guardianId` 미통보. |
| LS7 ✅ | 성장평가 목록 페이지에서 타 선수 데이터 노출 | `football/src/pages/players/GrowthReportsListPage.tsx:28-31` | GUARDIAN 롤 사이드바에 `/growth-reports` 메뉴 노출, 타 아이의 성장평가 열람 가능. IDOR 취약점. |
| LS8 ✅ | 수납증빙 제출 시 feeId 소유권 미검증 | `apps/api/src/guardian/guardian.service.ts:74-76` | `submitFeeProof(feeId, url)`이 해당 feeId가 자녀의 청구서인지 확인하지 않음. IDOR 취약점. |
| LS9 | 입단 신청 등록 시 학부모 동의 요청 알림 없음 | `apps/api/src/youth-registration/youth-registration.service.ts:31-43` | `create()` 후 `guardianId` 배정·계정 생성되나 `createForGuardian` 알림 전혀 없음. |
| LS10 | 학부모가 경기 결과·개인 스탯 볼 화면 없음 | `football/src/pages/youth/GuardianPortalPage.tsx` | `getDashboard()` API가 `stats.lastMatch` 포함하나 GuardianPortalPage에서 렌더링 코드 없음. |

---

## 섹션 12: 훈련·전술 총괄 / UX·접근성

### 알렉스 퍼거슨 (1군 감독, 영국, 20년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| AF1 | 미래 세션 계획 불가 — 세션이 소급해서만 등록 가능 | `apps/api/src/training/training.service.ts:37-39` | `createSession`이 미래 날짜에 `SESSION_DATE_FUTURE_NOT_ALLOWED` 예외. 주간 훈련 블록 사전 계획 불가. |
| AF2 | 경기 일정 인식 없는 세션 계획 — 피리오다이제이션 불가 | `apps/api/src/training/dto/training.dto.ts:3-10` | `TrainingSession`에 `matchId`·match-day minus 필드·강도 티어 없음. MD-5 고강도/MD-1 활성화/MD+1 회복 주기 강제 불가. |
| AF3 | `SquadPlan` 포메이션이 경기 라인업에 미연동 | `apps/api/src/match/match.lineup.service.ts:29-46` | `saveLineup`이 임의 자유 텍스트 포메이션 수용, `SquadPlan` 읽기 없음. 시즌 전술 형태와 경기 포메이션 불일치 무경고. |
| AF4 | 벤치에 교체 진입 순서 없음 | `apps/api/prisma/schema.prisma:2288-2300` | `LineupSlot`에 `isStarter: boolean`만, `substituteOrder` 없음. 사전 계획 교체 순서 추적 불가. |
| AF5 | 포메이션 스냅샷이 형태 문자열만 기록 — 교체 선수 미포함 | `apps/api/src/formation-snapshot/dto/formation-snapshot.dto.ts:1-7` | `formation`(string)·`minute`·`changeReason` 저장하나 선수 슬롯 데이터 없음. 교체 후 실제 형태 재구성 불가. |
| AF6 | `TacticalAnalysis`에 `PRE_MATCH`·`POST_MATCH`만 — 하프타임 없음 | `apps/api/prisma/schema.prisma:244-247` | `TacticalPhase` enum에 `HALF_TIME`·`LIVE` 없음. 하프타임 전술 조정 공식 기록 불가. |
| AF7 | 사후 분석이 다음 훈련 주기에 자동 연결 안 됨 | `apps/api/src/tactical/tactical.service.ts:61-73` | `confirmAnalysis`가 상태 플래그만 설정. `improvementNote`·`concededAnalysis`가 `TrainingSession` 생성에 미참조. |
| AF8 | `PlayerDevelopmentPlan`에 구조적 마일스톤 없음 | `apps/api/src/development-plan/dto/development-plan.dto.ts:1-16` | `goals`가 단일 자유 텍스트. 마일스톤 날짜·정량 KPI·목표치 없음. |
| AF9 | TRAINING 타입 콜업에 최대 기간·세션 한도 없음 | `apps/api/src/player-callup/player-callup.service.ts:74-91` | 선택적 `endDate`·체크 없이 단계 없이 승인. 유소년 선수의 1군 훈련 누적 부하 지침 강제 불가. |
| AF10 | `TrainingSession.updateSession`이 `sessionType` 수정 불가 | `apps/api/src/training/training.service.ts:121-143` | 수정 경로가 `{ date?, goal? }`만 수용. `PHYSICAL`→`TACTICAL_FULL_TEAM` 변경 불가, 세션 삭제 후 재생성 필요 (출결·결과 레코드 소실). |

### Ash (UX/UI Design Lead, 영국, 10년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| A1 | 출결 페이지 N+15 워터폴, 로딩 인디케이터 없음 | `football/src/pages/training/TrainingAttendancePage.tsx:82-84` | `trainingApi.list()` 후 최대 15개 병렬 `trainingApi.get(s.id)` 호출. 전체 시간 동안 UI가 blank. |
| A2 | 계약 상태 변경이 확인 다이얼로그 없이 즉시 실행 | `football/src/pages/contracts/ContractsPage.tsx:153-161` | 인라인 `<Select>`가 `onValueChange`에 즉시 `handleStatusChange()` 호출. `ACTIVE→TERMINATED`가 확인 없이 비가역적 실행. |
| A3 | 원장 기간 마감 버튼이 확인 없이 destructive 변형 사용 | `football/src/pages/finance/LedgerPage.tsx:67-72` | `variant="destructive"` 버튼이 클릭 시 바로 `handleLockPeriod()`. `useConfirm` 미사용. |
| A4 | 티켓 판매 삭제가 `window.confirm` 사용 — 디자인 시스템 불일치 | `football/src/pages/finance/TicketSalesPage.tsx:243` | `handleDelete`가 native `confirm('...')`. 다른 모든 비가역적 액션은 커스텀 `useConfirm` 훅. 패턴 불일치, i18n 차단. |
| A5 | 계약 페이지가 선수별 조회만 — 전체 만료 임박 계약 뷰 없음 | `football/src/pages/contracts/ContractsPage.tsx:125-262` | 단일 선수 선택 전 데이터 없음. 전체 스쿼드 계약·N개월 내 만료 필터 없음. |
| A6 | 부상 상태 선택이 RETURNED 포함 즉시 실행 | `football/src/pages/injuries/InjuriesPage.tsx:217-225` | 계약 페이지와 동일 안티패턴. `RETURNED` 설정이 부상 목록에서 선수를 즉시 제거, 확인 없음. |
| A7 | 스폰서십 생성 다이얼로그 버튼이 한국어 하드코딩 — i18n 위반 | `football/src/pages/sponsorship/SponsorshipPage.tsx:336-341` | `'취소'`·`'저장 중...'`·`'등록'` 리터럴 사용, `t()` 호출 없음. 폼의 나머지는 `useTranslation` 사용. |
| A8 | 대시보드 섹션이 API 에러 시 silent disappear — 에러 상태 없음 | `football/src/pages/dashboard/DashboardPage.tsx:169-179` | `opsReportApi.getOpsKpi()`·`salesApi.seasonTicketTotal()`·`dashboardApi.academyFinance()` 모두 `.catch(() => null)`. 실패 시 섹션 자체가 사라짐. |
| A9 | 훈련 출결 페이지가 로딩·빈 상태 중에도 `<Pagination>` 항상 렌더링 | `football/src/pages/training/TrainingAttendancePage.tsx:212-218` | `<Pagination>`이 조건부 블록 밖. `totalPages=0`·`totalItems=0`인 로딩·빈 상태에서도 노출. |
| A10 | PlayerFormDialog 국적 선택 로딩 상태 없음 — 빈 드롭다운 | `football/src/pages/players/PlayerFormDialog.tsx:74-79` | `useEffect`에서 국가 데이터 fetch하나 로딩 인디케이터 없음. API 응답 전까지 드롭다운 빈 상태. |

---

## 부록: 우선순위 매트릭스

### 즉시 수정 권고 (보안·데이터 무결성 위협)

| 우선순위 | 이슈 | 심각도 |
|---------|------|--------|
| 🔴 P0 | Toss 웹훅 HMAC 서명 미검증 (J9) | 금전 사기 직접 가능 |
| 🔴 P0 | 급여·수당 인가 체크 없음 (IS4, IS5, S4) | PII 전체 노출 |
| 🔴 P0 | 채용 온보딩 auth 없음 — MFA 우회 (IS6, SJ4) | 계정 탈취 가능 |
| 🔴 P0 | `getPayments` 비인증 접근 (P6) | 결제 정보 노출 |
| 🔴 P0 ✅ | 학부모 feeId IDOR 취약점 (LS8, LS7) | 타인 정보 열람·수정 |
| 🟠 P1 | 원장 기간 잠금 우회 (J1) | 재무 데이터 무결성 |
| 🟠 P1 | 급여 netPay 원장 기록 (J2) | 재무 과소 계상 |
| 🟠 P1 | 외화 KRW 하드코딩 (J6, P3) | 다통화 원장 오염 |
| 🟠 P1 | ACWR 더블카운팅 버그 (K1, E1) | 부상 위험 신호 억제 |
| 🟠 P1 | 의료 특별 범주 데이터 평문 저장 (RC2) | GDPR 9조 위반 |
| 🟡 P2 | UI 비가역적 액션 확인 없음 (A2, A3, A6) | 사용자 실수 위험 |
| 🟡 P2 | 감사 로그 다수 누락 (S5, KD2, P9, Y9) | 컴플라이언스 위험 |

---

*총 220개 Critical 이슈 · 22개 페르소나 · 12개 도메인 섹션*

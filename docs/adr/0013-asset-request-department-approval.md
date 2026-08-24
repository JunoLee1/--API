# ADR 0013: 자산 신청 — 부서 계층 재사용한 2단계 결재

**Status:** Accepted
**Date:** 2026-08-24

## Context

`Equipment`·`SoftwareLicense`는 관리 부서(EQUIPMENT_MANAGER·ASSET_MANAGER)의 top-down CRUD만 지원해서 일반 직원이 자산을 신청할 채널이 없었다. 지출 결재(`OperatingExpense`, PR #309)는 존재하나 FINANCE_STAFF → FINANCE_MANAGER 재무팀 내부 흐름이라 **부서 자율 결재**로 쓸 수 없다. 부서별 잔여예산 대시보드가 의미를 가지려면 개별 자산 신청이 곧바로 실적 지출로 이어져야 하며, 구독비·기기비 이중 승인 감사 로그 요구도 반영해야 한다.

## Decision

**부서 계층(`Department.parentId`/`headId`)을 재사용한 2단계 승인**을 채택한다.

- 신규 도메인 `asset-request` 모듈 — `AssetRequest` + `AssetRequestApproval` (감사 이력) 두 테이블.
- 결재 계층: 팀장 = 신청자 소속 leaf `Department.head`, 부서장 = 그 상위 `parent.head`. 신규 role 도입 없음. GM/ADMIN은 workflow 외부에서 audit 열람만 담당.
- 부서장 승인(APPROVED) 시점에 `OperatingExpense(status=APPROVED)`가 트랜잭션 내에서 자동 생성되어 재무 결재는 skip. 재무팀은 실지급(PAID) 실행과 감사만 처리한다.
- BudgetLine 매칭은 자동 — 신청자 leaf 부서 scope 우선, 없으면 `departmentId=null` 전사 공용 fallback. 둘 다 실패 시 `BUDGET_LINE_NOT_FOUND`.
- 예산 초과(`BUDGET_EXCEEDED`)는 부서장 승인 시점에 차단한다. SUBMITTED·LEADER_APPROVED 단계는 통과시키고, 최종 approve 호출에서 `createWithBudgetCheck()`가 방어한다.

## Alternatives Considered

**재무팀 3단계 결재 (팀장 → 부서장 → 재무팀):** 부서 자율성이 훼손되고 재무팀 병목이 발생. 부서 자율 결재라는 원 요구를 정면으로 위반. 기각.

**신규 role 도입 (REQUESTER·APPROVER 등):** 이미 `Department.head`가 결재권자 정보를 담고 있어 새 role은 중복. Coach·JerseyNumber와 동일하게 기존 스키마 재사용이 원칙이므로 scope creep. 기각.

**`Department` 계층 무시 flat 승인 (예: 모든 부서장이 서로의 요청 승인):** 부서 자율 결재라는 요구를 무너뜨리고 감사 근거가 약해짐. 기각.

## Consequences

**Positive:**
- 신청 lead time 단축 (재무 결재 skip). 부서 자율성 강화.
- 기존 `OperatingExpenseRepository.createWithBudgetCheck()` 재사용 — BudgetLine 매칭·초과 검증 로직 중복 방지.
- `AssetRequestApproval`에 LEADER + DEPT_HEAD 2행이 자동 축적되어 감사 로그 강도가 상승.
- `OperatingExpense.departmentId` 태깅으로 부서별 실적 pull 집계가 실시간 반영되어 잔여예산 대시보드가 의미 있어짐.

**Negative:**
- 자산 승인이 재무팀 사전 검토 없이 실적 지출로 반영됨 → 사후 audit(재무팀 감사)에 의존한다.
- `Department` 계층 seed 정비 부담. leaf 부서의 `headId`가 null이면 workflow 자체가 작동 안 함 — Task 3 Step 4에서 seed 정비를 필수로 처리.
- 신청자가 dept.head 겸직인 케이스(작은 부서에서 흔함)는 self-approval 차단 로직이 서비스 레이어에서 반드시 필요하다. DB 제약으로 표현 불가.

# ADR 0015: 채용 발령 — 3단계 결재 + 원자적 User 생성 워크플로우

**Status:** Accepted
**Date:** 2026-08-25

## Context

기존 채용 파이프라인은 `HiringNeedsSurvey → HiringPlanItem → PlanReport → JobPosting → JobApplication → Interview → ReferenceCheck → Onboarding` 순으로 이어지지만 **최종합격 이후 실제 발령까지의 공백**이 크다. `JobApplication.status`에 `OFFERED / HIRED / ONBOARDED` 값은 있으나, 그 사이를 채우는 세 단계 — **재무 최종 재검증**(TO·인건비·offer 일치), **임원 발령 승인**, **HR 실행**(User + UserDepartment + StaffRecord 원자적 생성) — 을 위한 model·상태·감사 로그가 존재하지 않는다. 또한 임원 스카웃·계약직 즉시 채용처럼 JobApplication 없이 시작되는 발령 케이스, 그리고 팀장이 발령 시점에 특수 권한 부여 필요를 HR에 전달할 채널도 부재하다.

## Decision

신규 `hiring-dispatch` 도메인 모듈을 추가한다. `HiringDispatch`(발령 절차) + `HiringDispatchApproval`(감사 이력) 두 테이블로 4-gap을 통합 관리한다.

- **3-stage 결재**: BUDGET_REVIEW(재무팀 매니저) → DISPATCH_APPROVAL(임원, `isAdminLike`) → EXECUTION(HR 매니저). 각 stage self-approval 차단. `@@unique([dispatchId, stage])`로 stage당 결정 1행만 허용.
- **`applicationId Int? @unique` (nullable)**: 기본 흐름은 Application OFFERED 검증 후 create. 예외 흐름(임원 스카웃, 계약직 즉시 채용)은 HR이 candidateName/Email 직접 입력하여 Application 없이 create.
- **`Onboarding.hiringDispatchId Int? @unique` 추가**: 온보딩이 JobApplication 뿐 아니라 HiringDispatch로도 트리거될 수 있게 함. `applicationId XOR hiringDispatchId`는 app-level 검증(Prisma CHECK 미지원).
- **EXECUTION 시점 원자적 실행**: `prisma.$transaction` 안에서 순서대로 `PhoneNumber → User → UserDepartment → StaffRecord → Onboarding → status 전환` 실행. email 중복은 tx 진입 전 pre-check로 차단.
- **`permissionNotes String?`**: HR-only 자유텍스트 필드. 팀장이 발령 요청 시 서술 → EXECUTION 알림에 HR에게 전달 → 발령 후 수동 권한 후속 부여. 상시 access request 채널(별도 model)은 non-goal.

## Alternatives Considered

**JobApplication.status 확장 (BUDGET_REVERIFIED / DISPATCH_APPROVED / DISPATCHED / ONBOARDED 4개 추가):** status enum bloat, 재무·임원·HR 결재 필드가 Application 스키마에 sparse하게 매달림, offer-side와 dispatch-side 관심사가 뒤섞임. 임원 스카웃(Application-free) 케이스 지원 불가. 기각.

**Onboarding 모델 확장 (앞 단계 결재 필드 추가):** Onboarding은 발령 후 계정 활성화 단계 — 재무 재검증·임원 승인이 그 안에 들어가면 모델 의미가 붕괴. 기각.

**신규 3개 model 분리 (BudgetReverify / DispatchApproval / DispatchExecution 각각):** 상태 흐름이 4-model에 흩어져 감사·조회가 어려워짐. 통합 상태머신 하나로 관리하는 편이 자연스러움. 기각.

## Consequences

**Positive:**
- 발령 전 과정 감사 로그가 `HiringDispatchApproval` 한 곳에 stage당 1행씩 축적 — 재무·임원·HR 결정의 근거·이유·override flag가 모두 보존됨.
- Application-free 발령 케이스(임원 스카웃, 계약직 즉시 채용)를 first-class로 지원. HR이 candidateName/Email만 있어도 발령 가능.
- User + UserDepartment + StaffRecord + Onboarding 생성이 `prisma.$transaction`으로 원자적 처리 — email 중복·PhoneNumber FK 오류 등 부분 실패 시 dangling row 방지.
- 재무 재검증(TO / 예산 / offer)이 결재 흐름에 강제됨 → 종전에 offer 이후 놓치기 쉽던 headcount·budget mismatch를 사전 차단.

**Negative:**
- 채용 도메인 model 개수 증가(2개 신규 + Onboarding 필드 확장). Onboarding은 이제 `applicationId` 또는 `hiringDispatchId` 중 하나로만 채워지는 dual reference — XOR 제약은 DB로 강제 불가하여 app-level `Onboarding.create` 시점 검증에 의존.
- 발령 대상자 candidate PhoneNumber·nationalityId·dateOfBirth는 현재 스펙에 없어 placeholder(`000-0000-0000`, `1`, `2000-01-01`)로 seed 후 온보딩에서 사용자가 교체하는 구조 — 실제 온보딩 UX가 이를 반드시 수집하도록 back-fill 로직이 필요.
- Q10 D의 3항목 재검증 중 예산 잔액 hard-fail(`Department.monthlyLaborBudget` 부재)과 offer 일치(`JobApplication.offeredSalary` 부재)는 스키마 미비로 현재 skip 상태 — `TODO` 주석으로 표시. TO 초과만 warning + override로 구현.
- 신청자가 dept.head 겸직인 케이스처럼 self-approval 차단은 서비스 레이어 3-stage 각각에서 명시적으로 처리해야 하며 DB 제약으로 표현 불가.

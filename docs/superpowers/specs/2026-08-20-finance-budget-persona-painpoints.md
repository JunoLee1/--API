# 예산 승인 & 운영비 — 페르소나별 Pain Point 분석

**작성일**: 2026-08-20  
**분석 대상**: 재무팀 / HR팀 / 구단주  
**범위**: 예산 승인 플로우, 운영비 관리, P&L 보고

> 각 Pain Point는 실제 소스 코드(서비스·레포·스키마)를 읽고 도출한 결과입니다. 코드 레퍼런스를 함께 기재합니다.

---

## 공통 최우선 이슈 (3개 페르소나 모두 지적)

| # | 이슈 | 관련 파일 |
|---|------|-----------|
| C1 | **BudgetHeader ↔ FinancialReport 단절** — 두 예산 구조가 외래키 없이 병렬 존재, "공식 승인 예산"과 "카테고리 운용 예산"이 서로 연결되지 않음 | `schema.prisma` (BudgetHeader, FinancialReport) |
| C2 | **BudgetOverrideLog에 status 없음** — 초과 지출 사유 기재 즉시 처리 완료. 구단주·재무팀의 사후 승인·거부 절차 없음 | `financial-report.service.ts:79~91`, `schema.prisma:2541~2551` |
| C3 | **외부 수입 수동 입력 이력 없음** — `revenueBroadcast`, `revenueSubsidy`, `revenueParentCompany`는 단순 upsert 덮어쓰기, 변경 이력 테이블 없음 | `financial-report.repo.ts` (upsert) |

---

## 재무팀 Pain Points

| # | 제목 | 설명 | 관련 코드 |
|---|------|------|-----------|
| F1 | **예산 승인 단일 단계** | `BudgetControlService.approve()`는 SUBMITTED → APPROVED를 단 한 명이 즉시 처리. 팀장→CFO 다단계 결재 구조 없음 | `budget-control.service.ts` |
| F2 | **예산 조정 셀프 승인 허용** | `/adjustments/:adjId/approve`는 `checkWrite`만 통과하면 요청자 본인도 승인 가능 | `budget-control.routes.ts:37` |
| F3 | **BudgetCategoryPlan에 승인 상태 없음** | Save 버튼 클릭 즉시 upsert, DRAFT→SUBMITTED→APPROVED 워크플로와 완전 단절 | `BudgetPlanPage.tsx`, `financial-report.repo.ts` |
| F4 | **운영비 사전 승인 로직 없음** | `OperatingExpenseService.create()`는 예산 초과 여부만 체크. 금액 무관 즉시 확정 | `operating-expense.service.ts:26` |
| F5 | **overrideReason 단독 처리, 사후 게이트 없음** | override 기록은 되지만 `BudgetOverrideLog.status` 없어 검토 완료 추적 불가 | `financial-report.service.ts:79~91` |
| F6 | **BudgetLine.category — 자유 문자열 vs enum 불일치** | `BudgetLine.category`는 `String`, `OperatingExpense.category`는 `OperatingCategory` enum. 대소문자 불일치 시 예산 vs 실적 비교 silently 깨짐 | `schema.prisma`, `budget-control.repo.ts` |
| F7 | **P&L 수동 입력 항목 변경 이력 없음** | 중계권·보조금·모기업 지원금은 upsert 덮어쓰기, LedgerEntry 연계 없음 | `financial-report.repo.ts` (upsert) |
| F8 | **시즌 간 예산 이월(Carryover) 자동화 없음** | `AdjustmentType.CARRYOVER` enum 존재하나 전년도 잔여 예산 자동 계산·생성 로직 없음 | `schema.prisma` (AdjustmentType) |
| F9 | **BudgetHeader ↔ FinancialReport 단절** | `getAvailableBudget()`은 BudgetHeader 기준, 운영비 한도는 BudgetCategoryPlan 기준. 이중 기준 혼란 | `budget-control.repo.ts`, `operating-expense.service.ts` |
| F10 | **운영비 수정 API 없음** | 라우트에 `PATCH /:id` 없음, `OperatingExpenseRepository.update()` 없음. 오입력 시 삭제 후 재등록 필요 | `operating-expense.routes.ts`, `operating-expense.repo.ts` |

---

## HR팀 Pain Points

| # | 제목 | 설명 | 관련 코드 |
|---|------|------|-----------|
| H1 | **HR 보고서 결재 단계 하드코딩 + 승인 권한자 미검증** | 3단계 결재가 소스에 고정, `approve()`는 `reviewerId` 직책 미검증. 1차 승인자가 2차까지 처리 가능 | `report.service.ts:127~139` |
| H2 | **스태프 급여 예산 기준선 없음** | `FinancialReport` 스키마에 `staffSalaryBudget` 필드 없음. 연말 실집행액과 비교할 예산 기준선 부재 | `schema.prisma:2410~2433` |
| H3 | **헤드카운트 계획 추적 기능 전무** | 시즌별 목표 헤드카운트·FTE 계획 모델 없음. `OperatingCategory`에 인건비·채용 카테고리 없음 | `schema.prisma:2486` |
| H4 | **계약 변경이 과거 시즌 수치까지 즉시 변경** | `getActuals()`가 현재 ACTIVE 계약 salary를 실시간 반영. 계약 변경 전·후 시뮬레이션 API 없음 | `financial-report.repo.ts:138` |
| H5 | **HR 고유 지출 카테고리 없음** | 교육비·복지 프로그램 비용 카테고리가 enum에 없어 `INVALID_CATEGORY` 오류. 엑셀 별도 관리 필요 | `operating-expense.service.ts:26`, `schema.prisma:2486` |
| H6 | **성과 보너스 예산 풀 미연결** | `PerformanceBonus` 모델 존재하나 `BudgetCategoryPlan`에 보너스 예산 필드 없고 `getPnL()` 집계에도 미포함 | `schema.prisma:1080`, `financial-report.service.ts` |
| H7 | **운영비에 부서 귀속 없어 부문별 HR 비용 배분 불가** | `OperatingExpense`에 `departmentId` 없음. `BudgetLine`의 `departmentId`와 실지출 미연결 | `schema.prisma:2553`, `schema.prisma:2601` |
| H8 | **퇴직·채용 시 예산 영향 즉시 미보고** | `terminatedAt` 세팅·신규 `StaffSalary` 생성 시 예산 잔액 재계산·알림 로직 없음 | `operating-expense.service.ts:58~62` |
| H9 | **HR 보고서 반려 단계·주체 불명확** | `reject()`와 `rejectReview()` 두 경로 혼재, 반려 단계 필드 없어 감사 로그 없이 추적 불가 | `report.service.ts:154~183` |
| H10 | **PayrollRun 월별 인건비 추이 없음** | `PayrollRun.month` 필드 있으나 월별 groupBy API 없어 시즌 중 인건비 흐름 파악 불가 | `financial-report.service.ts:290~294` |

---

## 구단주 Pain Points

| # | 제목 | 설명 | 관련 코드 |
|---|------|------|-----------|
| O1 | **경영 대시보드 없음** | 수익 달성률·가용 예산·카테고리 집행률을 한 화면에서 볼 수 없음. `/pl`, `/budget`, `/available` 별도 조합 필요 | `financial-report.routes.ts` |
| O2 | **예산 최종 승인에 구단주 거부권(veto) 없음** | `canWriteFinance` 권한자면 누구나 승인 가능. 승인 후 재보류 플로우 없음 | `budget-control.routes.ts:37`, `schema.prisma` (BudgetHeader.approvedById) |
| O3 | **대규모 지출 사전 결재 워크플로우 없음** | `OperatingExpense`에 `status` 필드 없음. 입력 즉시 실적 집계. 임계값 기반 사전 승인 없음 | `schema.prisma:2553~2572` |
| O4 | **시즌 간 비교(YoY) 분석 API 없음** | `getPnL(seasonId)`는 단일 시즌만 반환. 복수 시즌 비교 엔드포인트 없음 | `financial-report.routes.ts` |
| O5 | **선수 투자 ROI 지표 없음** | `playerSalary` 합계만 존재. 스카우팅 비용과 선수 성과 간 연결 없어 투자 회수 판단 불가 | `financial-report.service.ts`, `schema.prisma` |
| O6 | **지출 초과 알림 임계값 설정 기능 없음** | `BudgetCategoryPlan`에 `alertThreshold` 필드 없음. 예산 초과 후 사후 인지 | `schema.prisma` (BudgetCategoryPlan), `financial-report.service.ts` |
| O7 | **BudgetOverrideLog 사후 승인 절차 없음** | `addOverride()`에 status 없어 사유 기재 즉시 처리 완료 | `financial-report.service.ts:79~91` |
| O8 | **부서별 예산 책임 구조 불완전** | `BudgetLine.departmentId`가 `Int?`(선택값), `getAvailableBudget()`이 부서별 잔여 예산 미반환 | `schema.prisma:2604`, `budget-control.repo.ts` |
| O9 | **외부 수입 수동 입력 버전 이력 없음** | `revenueBroadcast` 등 3개 항목 변경 이력 테이블 없음. 단순 upsert 덮어쓰기 | `financial-report.repo.ts` |
| O10 | **통합 P&L과 BudgetHeader 미연결** | 두 독립 예산 구조 간 외래키 없고 `getPnL()`도 `BudgetHeader` 참조 안 함. 승인 예산 대비 집행 현황 단일 뷰 불가 | `schema.prisma`, `financial-report.service.ts` |

---

## 이슈 우선순위 매트릭스

| 우선순위 | 이슈 | 페르소나 | 난이도 |
|----------|------|----------|--------|
| 🔴 Critical | C1 — BudgetHeader ↔ FinancialReport 단절 | 전체 | 높음 |
| 🔴 Critical | F9/O10 — 이중 예산 기준 혼란 | 재무·구단주 | 높음 |
| 🔴 Critical | C2 — BudgetOverrideLog status 없음 | 전체 | 낮음 |
| 🟠 High | F2 — 예산 조정 셀프 승인 | 재무 | 낮음 |
| 🟠 High | O3 — 대규모 지출 사전 결재 없음 | 구단주 | 중간 |
| 🟠 High | H1 — HR 보고서 결재 권한자 미검증 | HR | 낮음 |
| 🟠 High | F10 — 운영비 수정 API 없음 | 재무 | 낮음 |
| 🟡 Medium | F6 — category 타입 불일치 | 재무 | 낮음 |
| 🟡 Medium | H7 — 운영비 부서 귀속 없음 | HR | 중간 |
| 🟡 Medium | O4 — YoY 비교 API 없음 | 구단주 | 중간 |
| 🟡 Medium | H10 — PayrollRun 월별 추이 없음 | HR | 낮음 |
| 🟡 Medium | C3/O9 — 외부 수입 이력 없음 | 전체 | 낮음 |
| 🟢 Low | H3 — 헤드카운트 계획 없음 | HR | 높음 |
| 🟢 Low | O5 — 선수 투자 ROI 없음 | 구단주 | 높음 |
| 🟢 Low | H4 — 계약 변경 과거 수치 영향 | HR | 중간 |

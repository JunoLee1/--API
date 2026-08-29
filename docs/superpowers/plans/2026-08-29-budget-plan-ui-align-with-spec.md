# BudgetPlanPage UI Align with 편성 워크플로우 Spec

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) 또는 `superpowers:executing-plans`. 각 task 는 `- [ ]` 체크박스로 추적.

**Supersedes:**
- `2026-08-22-budget-plan-dynamic-form-wizard.md` (자유 티어 개수/이름/value 입력 — spec 과 충돌)
- `2026-08-22-budget-plan-drag-drop-autosave.md` (자유 티어 전제로 D&D 순서 — 티어 고정되면 무의미)
- `2026-08-23-available-budget-kpi.md` (WageCapKPI 확장 — 편성 spec 의 planStatus 기반으로 재해석 필요)

**Reason for supersede:** 2026-08-29 편성 워크플로우 spec (ADR 0011/0019/0020/0021/0022 + `2026-08-29-annual-budget-planning-workflow.md`) 이 티어 자동 승격·value 자동 계산·트리거 기반 입력을 확정. 기존 plan 들이 상정한 "팀장 자유 편집" 모델과 정반대.

## Goal

`BudgetPlanPage` (및 하위 컴포넌트) 를 편성 워크플로우 spec 에 정렬. 팀장·부서장 입력을 **트리거 근거 다중선택 + Standard/Premium 델타** 로만 좁히고, 티어 이름·개수·value 는 시스템이 자동 결정.

## Legacy → Spec 대응표

| 축 | Legacy UI (구현됨) | Spec 2026-08-29 | 조치 |
|---|---|---|---|
| 티어 개수 | 자유 (사용자 add/remove) | 고정 3 (Basic/Standard/Premium) | 「+ 옵션 추가」 버튼 제거 |
| 티어 이름 | 자유 텍스트 | 고정 label | Input → 고정 label |
| `cost` (Basic) | 팀장 입력 | budget-automation preview 자동 | Input → read-only 표시 |
| `cost` (Standard/Premium) | 팀장 입력 | Basic + 팀장 델타 | Input → 델타 입력 (`standardDelta`, `premiumDelta`) |
| `value` | **팀장 직접 입력** | **자동 계산 (Δcost × Σ multiplier)** | **Input 제거 or read-only** |
| 트리거 선택 UI | 없음 | 다중선택 (MULTI_LOCATION/DIRECT_BUSINESS/PUBLIC_UTILITY/HOME_MATCH/WEEKEND_OVERTIME) | **신규 다중선택 컴포넌트** |
| 근거 문서 첨부 | 없음 | evidenceUrl (선택), comment (선택) | 신규 파일 업로드 필드 |
| 신청 제출 | `upsertBudgetPlan` 직접 저장 | `POST /financial-reports/:seasonId/plan-requests` (spec API) | 저장 API 교체 |
| 저장 시점 | Wizard 마지막 [완료] 즉시 저장 | Draft 자동 저장 + [제출] 로 status=SUBMITTED | 2단계 (draft/submit) |
| Wizard 페이지 구성 | 요약 + 카테고리 5개/page | 유지 (인지 부하 감소 목적은 그대로) | 유지 |
| D&D 정렬 | 자유 티어 순서 D&D | 고정 3티어 → D&D 대상 X. 카테고리 순서 D&D 는 유지 가능 | 티어 D&D 제거, 카테고리 D&D 유지 |
| Auto-save | 편집 중 debounce | Draft 자동 저장으로 통합 | 유지 |
| `mandatoryMinimum` | wizard 첫 페이지 입력 (팀장) | ADR 0022 별도 승인 프로세스 (FM/GM) | wizard 에서 제거, 별도 UI |

## Architecture

**순수 프론트엔드 리팩** (백엔드 spec API 는 배포 완료 = #402, #403). 새 스키마 필요 없음.

**Tech Stack:** React + TypeScript + shadcn/ui + i18next. 기존 wizard shell 재사용.

**Scope 제한:**
- ADR 0022 (mandatoryMinimum 승인 UI) 는 별도 spec (미착수)
- BudgetOverrideLog 이의 신청 UI (#407 backend) 는 별도 slice
- 재편성 트리거 UI (#408) 도 별도 slice

## File Structure

**Modified:**
- `football/src/pages/admin/BudgetPlanPage.tsx` — 편성 status 별 view 분기
- `football/src/components/budget-plan/BudgetPlanWizard.tsx` — 팀장/부서장 view 로 재작성 (FM view 는 별도)
- `football/src/components/budget-plan/BudgetCategoryPage.tsx` — 카테고리별 신청 form 으로 재작성
- `football/src/components/budget-plan/CategoryEditor.tsx` — 트리거 다중선택 + 델타 입력으로 재작성
- `football/src/components/budget-plan/types.ts` — DraftTier 제거, `PlanRequestLineDraft { categoryId, triggers[], standardDelta, premiumDelta, evidenceUrl, comment }` 신설

**Removed:**
- `football/src/components/budget-plan/TierRow.tsx` — 팀장이 직접 티어 편집하는 UI 폐기
- `football/src/components/budget-plan/BudgetAdvancedPanel.tsx` — 팀장 대상이면 폐기, FM 대상이면 별도 재구성

**New:**
- `football/src/components/budget-plan/TriggerMultiSelect.tsx` — 5종 트리거 chip 다중선택
- `football/src/components/budget-plan/PlanRequestSubmitDialog.tsx` — 제출 confirm
- `football/src/components/budget-plan/FinanceManagerReview.tsx` — FM view (신청 현황 + execute knapsack + finalize)
- `football/src/components/budget-plan/PlanStatusBadge.tsx` — planStatus 7단계 UI 표시

**Services:**
- `football/src/services/budget-plan.service.ts` (신규) — `openReview`, `submitPlanRequest`, `listPlanRequests`, `executeKnapsack`, `finalize`, `gmApprove`, `rePlan`, `requestOverride`, `reviewOverride` (모두 spec API)

## Implementation Steps (tracer bullet slices)

### Slice 1: DraftTier 폐기 + PlanRequestLineDraft 도입 (types-only)
- [ ] `types.ts` 재정의
- [ ] 기존 DraftTier 참조 컴파일 에러 발생 → 확인만
- [ ] test: type-level

### Slice 2: TriggerMultiSelect 컴포넌트 (독립)
- [ ] 5종 chip 다중선택 UI
- [ ] i18n label
- [ ] test: 클릭 → onChange 검증

### Slice 3: CategoryEditor 재작성 (트리거 + 델타)
- [ ] 티어 자유 편집 → 카테고리별 트리거 다중선택 + Standard/Premium 델타 + evidence url + comment
- [ ] `value` 자동 계산 preview 표시 (read-only)
- [ ] TierRow.tsx 삭제
- [ ] test: form submit shape 검증

### Slice 4: BudgetPlanWizard 팀장 view 재구성
- [ ] planStatus === AWAITING_REVIEW 시 wizard 표시
- [ ] 그 외 상태에서는 read-only 요약
- [ ] 카테고리별 신청 line 수집 → 제출 API 호출
- [ ] test: happy path + planStatus mismatch

### Slice 5: budget-plan.service.ts (프론트 API 클라이언트)
- [ ] spec 9개 API 함수 wrap
- [ ] React Query 통합
- [ ] test: mock API 응답 처리

### Slice 6: PlanStatusBadge + BudgetPlanPage view 분기
- [ ] planStatus 7단계 별 UI (badge + description)
- [ ] page routing: 팀장/부서장 view vs FM view

### Slice 7: FinanceManagerReview 컴포넌트
- [ ] 신청 현황 조회 (list-plan-requests)
- [ ] execute-knapsack 버튼
- [ ] finalize 버튼 (self-approval 있으면 GM escalate 안내)

### Slice 8 (별도 후속 spec): mandatoryMinimum 승인 UI (ADR 0022)
- 이 slice 는 별도 spec 필요 (미착수)

### Slice 9 (별도 후속): BudgetOverrideLog 이의 신청 UI (#407 backend)
### Slice 10 (별도 후속): 재편성 트리거 UI (#408 backend)

## Rollout

1. Slice 1-2: 컴포넌트 신설, 기존 UI 안 건드림 (dark 배포)
2. Slice 3-5: CategoryEditor 교체 + service 도입 → E2E 검증
3. Slice 6-7: view 분기 + FM UI → 파일럿 시즌 (2027) 편성 사이클에 실투입

## Test Plan
- 각 slice unit test 확보
- E2E: 팀장 로그인 → wizard 열기 → 트리거 선택 → 델타 입력 → 제출 → 신청 확인
- E2E: FM 로그인 → open-review → 팀장 신청 수집 → execute-knapsack → 결과 확인
- 회귀: OperatingExpense 지출 UI 는 영향 없음 (별도 워크플로우)

## Follow-up

- ADR 0022 (mandatoryMinimum 승인 UI) → 별도 plan
- BudgetOverrideLog UI → 별도 plan
- 재편성 트리거 UI → 별도 plan

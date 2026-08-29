# ADR 0022: mandatoryMinimum 세팅·승인 프로세스

**Status:** Accepted (grill 2026-08-29 Q1~Q11 결정)
**Date:** 2026-08-29
**Related:** [ADR 0011](0011-knapsack-operating-budget-allocation.md), [ADR 0019](0019-trigger-tier-promotion-rules.md), [ADR 0021](0021-notification-channels.md), [Spec 2026-08-29 편성 워크플로우](../superpowers/specs/2026-08-29-annual-budget-planning-workflow.md)

## Context

`BudgetCategoryPlan.mandatoryMinimum` 필드는 편성 워크플로우 capacity 계산의 핵심 입력이다.

- Spec 2026-08-29 Q7-A: **`Basic.cost ≥ mandatoryMinimum`** 불변식. 위반 시 CAPACITY_FAILED
- Context 노트 "의무 최소치·예비비 제외 재량 예산": mandatoryMinimum 은 "계약·법정 절대 하한" (예: 시설 임대료, 최저임금 인건비)

**Gap**: 필드는 존재하지만 —
- 값 세팅 API 없음
- 승인 워크플로우 없음
- 변경 이력 로그 없음
- 계약 갱신·법정 요건 반영 프로세스 없음

시즌 사이클마다 mandatoryMinimum 을 어떻게 확정하고 감사 가능한 상태로 유지할지가 미결.

## Decision

**세팅 권한 및 승인 계층**

| 역할 | 권한 |
|------|------|
| FINANCE_MANAGER | 카테고리별 mandatoryMinimum 초안 작성 (근거 문서 첨부 필수) |
| GM | 최종 승인 (전체 카테고리 합계 검토) |
| SUPER_ADMIN | 감사 로그 조회 및 이의 제기 (변경 없음) |

**세팅 시점**

- **정기 세팅**: 편성 워크플로우 시작 전 (`planStatus === DRAFT` 이전). `closeSeason()` 훅에서 Draft 생성하기 전에 mandatoryMinimum 이 확정되어 있어야 함.
- **변경**: 시즌 중 mandatoryMinimum 변경이 필요한 경우 (계약 갱신, 법정 최저임금 인상 등) → 재편성 트리거 필수 (Q12-III 이벤트 트리거 재편성)

**근거 요구사항** (Q4)

각 세팅/변경 시:
- `evidenceType`: `CONTRACT` (계약서) · `LEGAL` (법령) · `FIXED_COST` (계약 없는 고정비, GM 판단 필요)
- `evidenceUrl`: 근거 문서 URL (S3/Blob) — **CONTRACT/LEGAL 필수, FIXED_COST optional**
- `reason`: 자연어 사유 (항상 필수)
- `effectiveDate`: 발효일 (계약 개시일 등 감사용 기록; 승인 시점에 즉시 반영, cron 스케줄링 안 함 — Q9)

**감사 로그**

모든 세팅/변경은 `MandatoryMinimumChangeLog` 에 이력 기록 (append-only):
- 이전 값 · 새 값 · 변경자 · 승인자 · 근거 · 시점
- 조회 권한 (Q6): **FM · GM · SUPER_ADMIN** (편성 workflow 참여자 모두 read)

**변경 승인 프로세스**

```
FM 이 새 값 제안 (PENDING)
    │
    ├─ 감소 (기존 하한이 더 이상 필요 없음) → GM 승인 필요
    ├─ 증가 (계약 갱신·법정 인상 등)     → GM 승인 필요
    └─ 신규 카테고리                    → 초기값 0 (Q3), FM 세팅 필요 시 GM 승인

GM 승인 → 이력 기록 → mandatoryMinimum 즉시 반영 (Q9)

승인 대기 (PENDING) 상태에서 편성 트리거되면 이전 값으로 계산 (미승인 pending 은 무시)
```

**동일 카테고리 다중 PENDING 방지 (Q5)**

같은 `categoryPlanId` 에 이미 PENDING 이 있는데 FM 이 새 값을 제안하면, 이전 PENDING 은 자동 `CANCELED` 로 전이. `MinimumChangeStatus` enum 에 `CANCELED` 값 필요.

**REJECTED 후 재제안 (Q10)**

REJECTED 후 FM 은 같은 카테고리에 자유롭게 재제안 가능. UI 는 이전 REJECTED 의 `reviewNote` 를 다음 제안 dialog 상단에 표시하여 반려 사유 참고.

**변경 승인 후 재편성 트리거 (Q7)**

승인은 값 반영에 한정. 편성 재실행 (planStatus → RE_PLANNING) 은 **GM 이 GmReplanPanel 에서 별도 수동 트리거**. 자동 재편성 안 함 (여러 카테고리 연속 승인 시 재편성 반복 방지).

**승인 후 basicCost < newMinimum 위반 대응 (Q8)**

시즌 중 (FINALIZED 상태) mandatoryMinimum 증액이 승인되어 기존 `basicCost < 새 mandatoryMinimum` 이면:
1. 서버는 값을 그대로 반영 (임시 위반 상태 수용)
2. ADR 0021 알림 채널로 GM 에게 "재편성 필요" notify hook 발송
3. `BudgetPlanPage` 상단 warning 배너로 위반 카테고리 노출
4. GM 이 GmReplanPanel 에서 재편성 트리거하여 정합 회복

**Basic ≥ mandatoryMinimum 불변식 위반 처리**

Draft 생성 시 (spec 2026-08-29 Q11 캐스케이드) 이미 처리:
- CONSERVATIVE 재시도로 Basic 하향 → 여전히 위반이면 CAPACITY_FAILED
- GM alert (ADR 0021 채널) 로 mandatoryMinimum 재검토 필요 알림

## Alternatives Considered

**FM 단독 세팅 (승인 없음)**: 자율성 최대. 리스크: 계약 근거 없이 마음대로 하한 조정 → capacity 왜곡. 기각.

**Legal 부서 review + FM 결정**: 법정 요건은 Legal 자문이 이상적이나 Football repo 에 Legal role 없음 (자산관리 ERP 에만 있음). GM 이 대체 판단자 역할 커버 가능. 기각.

**자동 계산 (계약 DB 참조)**: `Contract` 모델에서 활성 계약의 minimum obligation 을 aggregate 하여 mandatoryMinimum 자동 세팅. 이상적이지만 계약 스키마에 minimum obligation 필드 없음 → 별도 스키마 확장 필요. 향후 확장 여지로 남겨두고 이번 라운드는 수동 세팅.

**변경 시 재편성 트리거 없음**: 시즌 중 mandatoryMinimum 만 조정하고 편성은 그대로. 리스크: 새 하한이 기존 Basic 보다 크면 즉시 불변식 위반. 기각. 재편성 필수.

## Consequences

**신규 스키마**

```prisma
enum MinimumEvidenceType {
  CONTRACT
  LEGAL
  FIXED_COST
}

enum MinimumChangeStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELED   // Q5: 동일 카테고리 새 PENDING 등장 시 이전 자동 취소
}

model MandatoryMinimumChangeLog {
  id                Int                     @id @default(autoincrement())
  categoryPlanId    Int
  previousAmount    Int
  newAmount         Int
  evidenceType      MinimumEvidenceType
  evidenceUrl       String?
  reason            String
  effectiveDate     DateTime
  status            MinimumChangeStatus     @default(PENDING)
  proposedById      Int                     // FM
  proposedAt        DateTime                @default(now())
  reviewedById      Int?                    // GM
  reviewedAt        DateTime?
  reviewNote        String?

  categoryPlan      BudgetCategoryPlan      @relation(fields: [categoryPlanId], references: [id], onDelete: Cascade)
  proposedBy        User                    @relation("MinimumProposer", fields: [proposedById], references: [id])
  reviewedBy        User?                   @relation("MinimumReviewer", fields: [reviewedById], references: [id])
}
```

**신규 API**

| Endpoint | 권한 | 목적 |
|----------|------|------|
| `POST /budget-category-plans/:id/mandatory-minimum` | FM | 세팅 제안 (PENDING) |
| `POST /mandatory-minimum-changes/:id/review` | GM | APPROVED/REJECTED |
| `GET /budget-category-plans/:id/mandatory-minimum/history` | SUPER_ADMIN | 변경 이력 조회 |

**closeSeason 훅 통합 (Q2)**

Draft 자동 생성 시 (`createDraftForNextSeason`) 다음 시즌의 `BudgetCategoryPlan.mandatoryMinimum` 을 이전 시즌 값에서 자동 copy. **변경이 없으면 GM 승인 게이트 없이 편성 시작 가능.** 새 카테고리는 0으로 시작 (Q3). FM 이 변경 필요할 때만 PENDING 제안 → GM 승인.

**UI 배치 (Q1)**

- **FM 뷰** — `FinanceManagerReview` 확장: 카테고리별 mandatoryMinimum 목록 + PENDING 배지 + `[값 제안]` dialog
- **GM 뷰** — `GmReplanPanel` 확장 (또는 병렬 컴포넌트): PENDING 승인 큐 통합 목록 + `[승인]/[반려]`
- **이력 조회** — 카테고리별 `MandatoryMinimumHistoryDialog` (FM/GM/SUPER_ADMIN read)
- **위반 배너** — `BudgetPlanPage` 상단 warning bar (basicCost < newMinimum 카테고리 노출)

**모니터링**

- 시즌 시작 시 mandatoryMinimum PENDING 인 카테고리 대시보드 (GM 승인 대기)
- 변경 이력이 오래 없는 카테고리 → 재검토 알림 (예: 12개월 이상 변경 없으면 alert)

## Follow-up

이 ADR 은 policy 만 확정. 실제 구현은 별도 이슈로:
- schema migration
- 3개 API endpoint
- `closeSeason` 훅 확장 (copy from prev season)
- 대시보드 (GM 승인 대기 목록)

# mandatoryMinimum 승인 프로세스 구현 plan

**Date:** 2026-08-29
**Status:** Ready-for-agent (grill Q1~Q11 완료)
**Origin issue:** #430
**Related:** [ADR 0022](../../adr/0022-mandatory-minimum-approval-process.md), [ADR 0021 알림 채널](../../adr/0021-notification-channels.md), [Spec 2026-08-29 편성 워크플로우](../specs/2026-08-29-annual-budget-planning-workflow.md)

## 목적

`BudgetCategoryPlan.mandatoryMinimum` 세팅·변경을 FM 제안 → GM 승인 감사 가능한 워크플로우로 구현. Backend 3 slice + FE 4 slice.

## 결정 사항 (grill 2026-08-29)

| # | 결정 |
|---|---|
| Q1 | UI 배치: `FinanceManagerReview` 확장 + `GmReplanPanel` 확장 (BudgetPlanPage 내부) |
| Q2 | 변경 없으면 승인 게이트 없음 (pending 있어도 편성 시 이전 값 사용) |
| Q3 | 새 카테고리 mandatoryMinimum 초기값 = 0 (게이트 없음) |
| Q4 | evidenceType 별 evidenceUrl: `CONTRACT`/`LEGAL` 필수, `FIXED_COST` optional. reason 항상 필수 |
| Q5 | 같은 categoryPlanId 새 PENDING 시 이전 PENDING → `CANCELED` (enum 확장) |
| Q6 | History read = FM / GM / SUPER_ADMIN |
| Q7 | 승인 후 재편성 = GM 이 `GmReplanPanel` 에서 수동 트리거 (자동 X) |
| Q8 | 승인 후 basicCost < newMinimum 이면 GM 알림 (ADR 0021 채널 + `BudgetPlanPage` 배너) |
| Q9 | effectiveDate 는 log 참고용, 승인 = 즉시 반영 (cron 스케줄링 X) |
| Q10 | REJECTED 후 자유 재제안 + UI 에 이전 reviewNote 표시 |
| Q11 | 이슈 분할: Backend 3 slice 먼저 → FE 4 slice |

## 스키마

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
  CANCELED   // Q5
}

model MandatoryMinimumChangeLog {
  id             Int                 @id @default(autoincrement())
  categoryPlanId Int
  previousAmount Int
  newAmount      Int
  evidenceType   MinimumEvidenceType
  evidenceUrl    String?             // CONTRACT/LEGAL 만 required (서비스 레이어에서 강제)
  reason         String
  effectiveDate  DateTime            // 참고용 (log 상 감사)
  status         MinimumChangeStatus @default(PENDING)
  proposedById   Int
  proposedAt     DateTime            @default(now())
  reviewedById   Int?
  reviewedAt     DateTime?
  reviewNote     String?

  categoryPlan BudgetCategoryPlan @relation(fields: [categoryPlanId], references: [id], onDelete: Cascade)
  proposedBy   User               @relation("MinimumProposer", fields: [proposedById], references: [id])
  reviewedBy   User?              @relation("MinimumReviewer", fields: [reviewedById], references: [id])

  @@index([categoryPlanId, status])
}
```

## API

| Endpoint | 권한 | 목적 |
|---|---|---|
| `POST /budget-category-plans/:id/mandatory-minimum` | FM | 세팅 제안 (PENDING) — 기존 PENDING 있으면 CANCELED 처리 후 신규 생성 |
| `POST /mandatory-minimum-changes/:id/review` | GM | APPROVED/REJECTED (APPROVED 시 categoryPlan.mandatoryMinimum 즉시 update + 위반 감지) |
| `GET /budget-category-plans/:id/mandatory-minimum/history` | FM/GM/SUPER_ADMIN | 카테고리별 전체 이력 (DESC by createdAt) |
| `GET /financial-reports/:seasonId/mandatory-minimum/pending` | FM/GM | GM 승인 큐 (해당 시즌 모든 카테고리의 PENDING 목록) |

## Vertical slice 이슈 (7)

### Backend

**B1. Schema + migration**
- Prisma 모델 3개 (enum 2 + model 1)
- migration 신설
- User relation naming: `MinimumProposer`, `MinimumReviewer`

**B2. 3 API + closeSeason 훅 확장**
- `mandatoryMinimum.service.ts` (propose/review/listHistory/listPending)
- `mandatoryMinimum.controller.ts` + routes
- 권한 가드 (FM/GM/SUPER_ADMIN 별)
- Multiple PENDING 방지 트랜잭션 (기존 PENDING → CANCELED + 신규 create)
- REJECTED reviewNote 필수 검증
- `closeSeason()` 훅에서 다음 시즌 `BudgetCategoryPlan.mandatoryMinimum` copy 로직 확인 (기존 동작 검증 + 필요 시 보강)

**B3. 승인 시 위반 감지 + 알림 hook**
- APPROVED 트랜잭션 후 fire-and-forget: `basicCost < newMinimum` 위반 감지
- 위반 시 ADR 0021 채널로 GM 에게 `MANDATORY_MINIMUM_VIOLATION_REQUIRES_REPLAN` NotificationType 발송
- `NotificationType` enum 확장

### Frontend

**F1. service.ts + hooks + types**
- `football/src/services/mandatory-minimum.service.ts` — 4 endpoint wrap
- React Query hooks: `useProposeMinimum` / `useReviewMinimum` / `useMinimumHistory(categoryPlanId)` / `usePendingMinimums(seasonId)`
- 타입 export: `MandatoryMinimumChangeLogDto`, `MinimumEvidenceType`, `MinimumChangeStatus`
- Query invalidation: `["financial-report", seasonId]` + `["budget-plan", "requests", seasonId]` + `["mandatory-minimum", categoryPlanId]`

**F2. MandatoryMinimumProposalDialog (FM 제안)**
- `football/src/components/budget-plan/MandatoryMinimumProposalDialog.tsx`
- Props: `{ categoryPlan: BudgetCategoryPlan; onSuccess?: () => void }`
- Form: newAmount + evidenceType select + evidenceUrl (CONTRACT/LEGAL 시 required) + reason + effectiveDate
- FM 이 이전 REJECTED reviewNote 를 dialog 상단에 표시 (있을 시)
- `useProposeMinimum` 호출
- 에러 코드 매핑 (한국어 sonner toast)
- FinanceManagerReview 확장: 카테고리별 목록 + PENDING 배지 + `[값 제안]` 버튼 wire-up

**F3. GM 승인 큐 (FinanceManagerReview + GmReplanPanel 통합)**
- `football/src/components/budget-plan/MandatoryMinimumApprovalQueue.tsx`
- Props: `{ seasonId: number }` (읽어서 usePendingMinimums)
- 각 pending row: 카테고리 / 제안자 / 이전값 / 새값 / evidenceType / evidenceUrl link / reason / effectiveDate
- `[승인] [반려]` 버튼 (반려 시 reviewNote 필수)
- 승인/반려 후 invalidation → 즉시 목록 refresh
- GmReplanPanel 확장: 상단에 이 큐 컴포넌트 embed

**F4. History dialog + 위반 배너**
- `football/src/components/budget-plan/MandatoryMinimumHistoryDialog.tsx` — categoryPlanId 별 이력 timeline
- FM/GM/SUPER_ADMIN 접근 가능 (Q6)
- 각 log entry: prev→new, evidenceType badge, evidenceUrl link, reason, effectiveDate, status pill, proposedBy/reviewedBy, reviewNote
- `BudgetPlanPage` 상단 warning 배너: `basicCost < mandatoryMinimum` 카테고리 노출 + "재편성 필요" 메시지 + GM 인 경우 재편성 트리거 shortcut

## 의존 그래프

```
B1 (schema)
  └─ B2 (API + closeSeason)
       └─ B3 (위반 감지 + 알림)
            └─ F1 (service + hooks)
                 ├─ F2 (FM 제안 dialog)
                 ├─ F3 (GM 승인 큐)
                 └─ F4 (history + 배너)
```

F2/F3/F4 는 F1 완료 후 병렬.

## Acceptance

- [ ] 스키마 + migration 배포 (B1)
- [ ] 4 endpoint 통합 테스트 통과 (B2)
- [ ] 승인 시 위반 감지 + ADR 0021 채널 알림 발송 (B3)
- [ ] FE 4 slice 통합 후 E2E: FM 제안 → GM 승인 → 값 반영 + 위반 시 배너 노출 → GM 재편성 트리거
- [ ] 재실행/idempotency: 같은 categoryPlanId 에 PENDING 두 번 요청 → 첫 번째 CANCELED 검증
- [ ] REJECTED 후 재제안 검증

## Non-goals

- Contract 스키마 통합 자동 세팅 (ADR 0022 Alternatives 에서 별도 확장)
- effectiveDate cron 스케줄링 (Q9, 승인 = 즉시)
- Legal 부서 review 워크플로우 (Football repo 에 Legal role 없음)
- 자동 재편성 트리거 (Q7, 항상 GM 수동)

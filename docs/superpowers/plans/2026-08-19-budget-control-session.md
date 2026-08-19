# 예산 관리 Plan A 구현 세션 요약

> 작성일: 2026-08-19  
> 브랜치: `feat/budget-control-plan-a`  
> 기반 PR: main ← #293 (스폰서십·아카데미 회비 RBAC 수정)

---

## 구현 완료 항목

### Backend (`apps/api/`)

- [x] **Prisma 스키마** — `BudgetHeader`, `BudgetLine`, `BudgetAdjustment` 모델 3개 + `BudgetStatus`, `AdjustmentType`, `AdjustmentStatus` enum 3개 추가; Season/User/Department 관계 연결; 마이그레이션 적용
- [x] **DTO** — `CreateBudgetHeaderDto`, `UpdateBudgetHeaderDto`, `CreateBudgetLineDto`, `UpdateBudgetLineDto`, `CreateAdjustmentDto`
- [x] **Repository** — `BudgetControlRepository` (CRUD 10개 메서드; findById 전체 include, sumApprovedAdjustments groupBy)
- [x] **Service** — `BudgetControlService` (13개 메서드); 가용예산 공식: `totalBudget + carryover + increase − decrease` (commitment/actual은 Plan B placeholder=0)
- [x] **Controller + Routes** — 13개 REST 엔드포인트; `canReadFinance`/`canWriteFinance` RBAC 가드
- [x] **apiRouter 등록** — `apiRouter.use("/budget-control", budgetControlRouter)`
- [x] **단위 테스트 12개** — `getAvailableBudget` (4), `submit` (3), `approve` (2), `requestAdjustment` (3)

### Frontend (`football/src/`)

- [x] **타입** — `BudgetStatus`, `AdjustmentType`, `AdjustmentStatus`, `BudgetLine`, `BudgetAdjustment`, `BudgetHeader`, `BudgetHeaderSummary`, `AvailableBudget`
- [x] **API 서비스** — `budgetControlApi` (13개 메서드, 백엔드 라우트 1:1 매핑)
- [x] **BudgetListPage** — 예산 목록·편성 등록 다이얼로그; `canWrite` RBAC (ADMIN/SUPER_ADMIN/GM/FINANCE_MANAGER)
- [x] **BudgetDetailPage** — 가용예산 현황·예산 라인 CRUD·조정 이력·결재 요청/확정 버튼
- [x] **라우터 등록** — `/finance/budget`, `/finance/budget/:id`
- [x] **사이드바 메뉴** — 재무 섹션에 "예산 관리" 항목 추가 (Wallet 아이콘, FINANCE_STAFF 포함)

---

## 커밋 목록 (14개)

| SHA | 메시지 |
|-----|--------|
| `b26c6c74` | feat(schema): add BudgetHeader, BudgetLine, BudgetAdjustment models |
| `9d5e9f65` | feat(budget-control): add DTOs |
| `918028a0` | feat(budget-control): add repository |
| `c7711875` | fix(budget-control): add missing DTO imports and includes in repository |
| `974ee816` | feat(budget-control): add service with available budget formula and tests |
| `2a403e5e` | feat(budget-control): add controller, routes, register in apiRouter |
| `8da45a12` | feat(fe/budget-control): add types and API service |
| `a9e2d461` | feat(fe/budget-control): add BudgetListPage |
| `a7b05414` | fix(fe/budget-control): add error handling in BudgetListPage load |
| `189f1262` | feat(fe/budget-control): add BudgetDetailPage with available budget view |
| `957c3104` | feat(fe/budget-control): register routes for BudgetListPage and BudgetDetailPage |
| `4fc671f4` | fix(fe/budget-control): add error handling to adjustment approve/reject buttons |
| `b7a75592` | fix(budget-control): tighten adjustment guard and fix nav visibility for FINANCE_STAFF |
| `7ddfaf2f` | test(budget-control): add requestAdjustment guard tests |

---

## 가용예산 공식 구현

```
가용예산 = 승인예산(totalBudget) + 이월(CARRYOVER) + 증액(INCREASE) − 삭감(DECREASE)
         (집행예정·실집행은 Plan B에서 추가 예정)
```

---

## 이번 세션에서 발견된 미결 이슈 (다음 세션 참고)

| 이슈 | 심각도 | 비고 |
|------|--------|------|
| 예산 편성 조정 요청 UI 없음 | Medium | `requestAdjustment` API는 존재하나 FE 폼 없음 → Plan B에서 구현 |
| self-approval 미방지 | Medium | 작성자가 본인 예산을 직접 승인 가능 → Plan B에서 가드 추가 |
| multi-tenancy 가드 없음 | High | 다른 시즌 ID로 타 클럽 예산 조회 가능 (전체 BE에 공통 이슈) |
| AcademyFeePage 업로드 버튼 | Low | 상태 가드 없이 모든 상태에서 표시됨 (PAID 포함) |
| AcademyFeePage canApprove | Low | `HR_MANAGER`로 설정됨 — 재무 역할로 변경 필요 여부 확인 필요 |
| TRANSFER 조정 공식 | Note | 전용(TRANSFER)은 총 가용예산 중립 (라인간 재배분) — 의도된 설계 |

---

## 다음 작업 (Plan B)

- BudgetCommitment + BudgetActual → 집행예정·실집행 차감 연동
- LedgerEntry 연동 → 실집행 자동 반영
- 조정 요청 FE 폼 (RequestAdjustmentDialog)
- self-approval 가드
- 예산 대시보드 (집행률, 80% 경보, 월별 차이)

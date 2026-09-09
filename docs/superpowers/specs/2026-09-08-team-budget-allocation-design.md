# 팀별 예산 배정 설계 (Department → Team Budget Allocation)

**Goal:** 부서에 배정된 시즌 예산을 소속 팀별로 min/max % 밴드로 재배분하고, 이월 금액을 자동 산정하며, 운영비 지출 시 팀 한도를 검증한다.

**Tech Stack:** Express + Prisma (BE only)

**Scope:** `DepartmentSeasonBudget` + `TeamBudgetAllocation` 신규 모듈, `OperatingExpense.teamId` 추가

---

## 1. 데이터 모델

### 신규: `DepartmentSeasonBudget`

부서의 시즌별 총 예산. 팀 배분 비율 계산의 기준이 되는 앵커.

```prisma
model DepartmentSeasonBudget {
  id           Int        @id @default(autoincrement())
  seasonId     Int
  departmentId Int
  totalAmount  Int
  createdAt    DateTime   @default(now())

  season       Season                 @relation(fields: [seasonId], references: [id])
  department   Department             @relation(fields: [departmentId], references: [id])
  allocations  TeamBudgetAllocation[]

  @@unique([seasonId, departmentId])
}
```

### 신규: `TeamBudgetAllocation`

부서 예산 중 각 팀의 배분 비율 및 이월 금액.

```prisma
model TeamBudgetAllocation {
  id                 Int                    @id @default(autoincrement())
  deptSeasonBudgetId Int
  teamId             Int
  minPercent         Float
  maxPercent         Float
  carryover          Int                    @default(0)
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  deptSeasonBudget   DepartmentSeasonBudget @relation(fields: [deptSeasonBudgetId], references: [id])
  team               Team                   @relation(fields: [teamId], references: [id])

  @@unique([deptSeasonBudgetId, teamId])
}
```

### 수정: `OperatingExpense`

```prisma
model OperatingExpense {
  // ... 기존 필드 ...
  teamId Int?
  team   Team? @relation(fields: [teamId], references: [id])
}
```

### 유효 한도 공식

```
effective_max = DepartmentSeasonBudget.totalAmount × maxPercent + carryover
```

---

## 2. 이월 산정 & 예산 검증

### 시즌 rollover (자동 이월 계산)

`SeasonService.updateStatus()` 에서 상태가 `COMPLETED`로 전환될 때 `TeamBudgetAllocationService.rolloverSeason(fromSeasonId, toSeasonId)` 호출:

```typescript
// 각 DepartmentSeasonBudget 순회
for (const deptBudget of deptBudgets) {
  for (const alloc of deptBudget.allocations) {
    const effectiveMax =
      deptBudget.totalAmount * alloc.maxPercent + alloc.carryover;

    const actualSpend = await repo.sumSpend({
      teamId: alloc.teamId,
      seasonId: fromSeasonId,
      // status NOT IN [CANCELLED, REJECTED]
    });

    const nextCarryover = Math.max(0, effectiveMax - actualSpend);

    // 다음 시즌 allocation 생성 (minPercent/maxPercent 복사, carryover 갱신)
    await repo.createAllocation({
      deptSeasonBudgetId: nextDeptBudget.id,
      teamId: alloc.teamId,
      minPercent: alloc.minPercent,
      maxPercent: alloc.maxPercent,
      carryover: nextCarryover,
    });
  }
}
```

### 지출 등록 시 예산 검증

`OperatingExpenseService.create()` 에서 `teamId` 있을 때:

```typescript
const alloc = await teamBudgetRepo.findByTeamAndSeason(teamId, seasonId);
if (alloc) {
  const effectiveMax =
    alloc.deptSeasonBudget.totalAmount * alloc.maxPercent + alloc.carryover;
  const alreadySpent = await repo.sumSpend({ teamId, seasonId });
  if (alreadySpent + amount > effectiveMax) {
    throw new AppError(422, 'TEAM_BUDGET_EXCEEDED');
  }
  // minPercent 미달 시 soft warning (차단 아님) — response: { data: ..., warnings: ["TEAM_BUDGET_UNDER_MIN"] }
}
```

- `maxPercent` 초과 → 422 차단
- `minPercent` 미달 → 경고만 (response body의 `warnings` 배열에 포함)
- `teamId` 없으면 검증 skip

---

## 3. 서비스·레포 구조

### 신규 모듈: `department-season-budget/`

```
apps/api/src/department-season-budget/
  department-season-budget.repo.ts     — create, findBySeason, findByDept
  department-season-budget.service.ts  — create(dto, actor), findBySeason(seasonId)
  department-season-budget.controller.ts
  department-season-budget.routes.ts
```

권한: ADMIN / GM / FINANCE_MANAGER만 생성·수정 가능.

### 신규 모듈: `team-budget-allocation/`

```
apps/api/src/team-budget-allocation/
  team-budget-allocation.repo.ts
    — findByTeamAndSeason(teamId, seasonId)
    — findByDeptBudget(deptSeasonBudgetId)
    — sumSpend(teamId, seasonId)
    — create(dto), update(id, dto)
  team-budget-allocation.service.ts
    — create(dto, actor)
    — update(id, dto, actor)
    — rolloverSeason(fromSeasonId, toSeasonId)
  team-budget-allocation.controller.ts
  team-budget-allocation.routes.ts
```

### 기존 수정

| 파일 | 변경 |
|---|---|
| `apps/api/prisma/schema.prisma` | `DepartmentSeasonBudget`, `TeamBudgetAllocation` 추가, `OperatingExpense.teamId Int?` |
| `apps/api/prisma/migrations/…` | 신규 마이그레이션 |
| `apps/api/src/operating-expense/operating-expense.service.ts` | `create()` 팀 예산 검증 추가 |
| `apps/api/src/operating-expense/operating-expense.repo.ts` | `teamId` 필터 추가 |

---

## 4. 테스트

- `TeamBudgetAllocationService.rolloverSeason()`: 이월 정확성, 음수 방지 (`max(0, ...)`)
- `OperatingExpenseService.create()` with teamId:
  - 한도 초과 → `TEAM_BUDGET_EXCEEDED` (422)
  - 잔액 내 → 성공
  - `minPercent` 미달 → 성공 + `warnings` 반환
  - `teamId` 없음 → 검증 skip, 정상 등록

---

## Phase 3 (별도 이슈)

- FE: 부서·팀별 예산 현황 대시보드 (잔액, 사용률, 이월 내역)
- 시즌 rollover API 엔드포인트 노출 (현재 내부 서비스 호출)

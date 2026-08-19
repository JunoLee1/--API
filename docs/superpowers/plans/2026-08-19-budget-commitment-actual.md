# Budget Commitment / Actual / Block Implementation Plan

**Date:** 2026-08-19  
**Grill answers:** Q1=B, Q2=A, Q3=C, Q4=C, Q5=D(skip), Q6=A, Q7=A, Q9=C

---

## 1. 설계 요약

| 항목 | 결정 |
|------|------|
| 전년도 수익 힌트 | BudgetHeader 다이얼로그에 전년도 `totalRevenue` 읽기 전용 표시 |
| 집행예정 | `OperatingExpense.paidAt IS NULL` = 집행예정 |
| 실집행 | `OperatingExpense.paidAt IS NOT NULL` = 실집행 |
| paidAt 설정 | FINANCE_STAFF/FINANCE_MANAGER "지급 확정" 버튼 → `PATCH /operating-expenses/:id/pay` |
| 가용예산 공식 | `승인예산 + 이월 + 증액 − 삭감 − 집행예정합계 − 실집행합계` |
| 카테고리별 잔액 | `OperatingCategory` enum GROUP BY 집계 |
| 예산 초과 | 하드 Block + `overrideReason` 있으면 강제 등록 허용 |
| budget_snapshot | 범위 밖 (3차 과제) |

---

## 2. Vault 가용예산 공식

```
가용예산 = 당시즌 승인예산 + 승인이월 + 승인증액 − 승인삭감 − 집행예정 − 실집행
```

- **집행예정**: `OperatingExpense WHERE seasonId=X AND paidAt IS NULL AND deletedAt IS NULL`
- **실집행**: `OperatingExpense WHERE seasonId=X AND paidAt IS NOT NULL AND deletedAt IS NULL`

---

## 3. Prisma 스키마 변경

### 3-1. OperatingExpense에 `paidAt` 추가

```prisma
model OperatingExpense {
  // ... existing fields ...
  paidAt    DateTime?   // null = 집행예정, 값 = 실집행
  paidById  Int?
  paidBy    User?       @relation("PaidExpenses", fields: [paidById], references: [id])
}
```

---

## 4. Migration SQL

```sql
ALTER TABLE "OperatingExpense"
  ADD COLUMN "paidAt"   TIMESTAMP(3),
  ADD COLUMN "paidById" INTEGER REFERENCES "User"("id");
```

---

## 5. BE 변경

### 5-1. OperatingExpense — 지급 확정 엔드포인트

```typescript
// operating-expense.routes.ts
router.patch('/:id/pay', auth(), async (c) => {
  const user = c.get('user')
  if (!['ADMIN', 'FINANCE_MANAGER', 'FINANCE_STAFF'].includes(user.role) &&
      !(user.role === 'FRONT_OFFICE' && user.frontOfficeRole === 'FINANCE_MANAGER')) {
    throw new AppError(403, 'FORBIDDEN')
  }
  const id = Number(c.req.param('id'))
  const result = await service.markPaid(id, user.id)
  return c.json(result)
})
```

```typescript
// operating-expense.service.ts
async markPaid(id: number, paidById: number) {
  const expense = await this.repo.findById(id)
  if (!expense) throw new AppError(404, 'NOT_FOUND')
  if (expense.deletedAt) throw new AppError(404, 'NOT_FOUND')
  if (expense.paidAt) throw new AppError(400, 'ALREADY_PAID')
  return this.repo.markPaid(id, paidById)
}
```

```typescript
// operating-expense.repo.ts
markPaid(id: number, paidById: number) {
  return this.prisma.operatingExpense.update({
    where: { id },
    data: { paidAt: new Date(), paidById },
  })
}
```

### 5-2. OperatingExpense — 초과 시 하드 Block (Q9=C)

`operating-expense.service.ts`의 `create()` 수정:

```typescript
async create(data: { ... overrideReason?: string ... }) {
  if (data.amount <= 0) throw new AppError(400, 'INVALID_AMOUNT')
  if (!DISCRETIONARY.includes(data.category)) throw new AppError(400, 'INVALID_CATEGORY')

  const plan = await this.repo.findBudgetPlan(data.seasonId, data.category)
  if (!plan) throw new AppError(400, 'BUDGET_PLAN_NOT_FOUND')

  const ceiling = plan.mandatoryMinimum + (plan.knapsackAllocated ?? 0)
  const currentSpend = await this.repo.sumSpendBySeasonAndCategory(data.seasonId, data.category)

  if (currentSpend + data.amount > ceiling) {
    // 하드 Block: overrideReason 없으면 차단
    if (!data.overrideReason) {
      throw new AppError(400, 'BUDGET_EXCEEDED', {
        ceiling,
        currentSpend,
        overAmount: currentSpend + data.amount - ceiling,
      })
    }
    // overrideReason 있으면 강제 등록 + 로그 + 알림
    const expense = await this.repo.create({ ...data, date: new Date(data.date) })
    await this.repo.createOverrideLog({ ... })
    // 알림 발송 (기존 코드 유지)
    return expense
  }

  return this.repo.create({ ...data, date: new Date(data.date) })
}
```

### 5-3. BudgetControl — 가용예산 공식 업데이트 (Q4=C)

`budget-control.service.ts`의 `getAvailableBudget()` 수정:

```typescript
async getAvailableBudget(id: number) {
  const header = await this.repo.findById(id)
  if (!header) throw new AppError(404, 'BUDGET_NOT_FOUND')

  const adjSums = await this.repo.sumApprovedAdjustments(id)
  const byType = Object.fromEntries(adjSums.map(r => [r.type, r._sum.amount ?? 0]))

  const approvedBudget = header.totalBudget
  const carryover = byType['CARRYOVER'] ?? 0
  const increase  = byType['INCREASE']  ?? 0
  const decrease  = byType['DECREASE']  ?? 0

  // 집행예정: paidAt IS NULL, 실집행: paidAt IS NOT NULL
  const { commitment, actual, byCategory } =
    await this.repo.sumCommitmentAndActual(header.seasonId)

  const available = approvedBudget + carryover + increase - decrease - commitment - actual

  // 카테고리별 잔액 (BudgetLine 레벨)
  const lineBreakdown = header.lines.map(line => {
    const cat = line.category as OperatingCategory | null
    const spent = cat ? (byCategory[cat] ?? 0) : 0
    return {
      id: line.id,
      category: cat,
      description: line.description,
      amount: line.amount,
      spent,
      remaining: line.amount - spent,
    }
  })

  return {
    headerId: id,
    status: header.status,
    approvedBudget,
    carryover,
    increase,
    decrease,
    commitment,
    actual,
    available,
    lineBreakdown,
  }
}
```

```typescript
// budget-control.repo.ts — 신규 메서드
async sumCommitmentAndActual(seasonId: number) {
  const rows = await this.prisma.operatingExpense.groupBy({
    by: ['category', 'paidAt'],
    where: { seasonId, deletedAt: null },
    _sum: { amount: true },
  })

  let commitment = 0
  let actual = 0
  const byCategory: Record<string, number> = {}

  for (const row of rows) {
    const amt = row._sum.amount ?? 0
    const cat = row.category as string
    byCategory[cat] = (byCategory[cat] ?? 0) + amt
    if (row.paidAt === null) commitment += amt
    else actual += amt
  }

  return { commitment, actual, byCategory }
}
```

### 5-4. FinancialReport — 전년도 수익 힌트 API (Q1=B)

`GET /financial-reports/prev-season-revenue?seasonId=X` 엔드포인트 추가:

```typescript
// financial-report.routes.ts
router.get('/prev-season-revenue', auth(), async (c) => {
  const seasonId = Number(c.req.query('seasonId'))
  const prisma = getPrisma()

  const currentSeason = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { endDate: true },
  })
  if (!currentSeason) return c.json({ prevRevenue: null })

  const prevSeason = await prisma.season.findFirst({
    where: { endDate: { lt: currentSeason.endDate } },
    orderBy: { endDate: 'desc' },
    select: { id: true },
  })
  if (!prevSeason) return c.json({ prevRevenue: null })

  const report = await prisma.financialReport.findUnique({
    where: { seasonId: prevSeason.id },
    select: { totalRevenue: true },
  })

  return c.json({ prevRevenue: report?.totalRevenue ?? null })
})
```

---

## 6. FE 변경

### 6-1. BudgetListPage — 전년도 수익 힌트 (Q1=B)

`CreateBudgetDialog` 컴포넌트에 힌트 표시:

```tsx
// 시즌 선택 시 전년도 수익 조회
const [prevRevenue, setPrevRevenue] = useState<number | null>(null)

useEffect(() => {
  if (!seasonId) { setPrevRevenue(null); return }
  financialReportApi.getPrevSeasonRevenue(Number(seasonId))
    .then(r => setPrevRevenue(r.prevRevenue))
    .catch(() => setPrevRevenue(null))
}, [seasonId])

// totalBudget 입력 필드 아래에 힌트 표시
{prevRevenue !== null && (
  <p className="text-xs text-muted-foreground">
    전년도 총수익: {prevRevenue.toLocaleString('ko-KR')}원
  </p>
)}
```

### 6-2. OperatingExpensePage — 지급 확정 버튼

지출 목록에 "지급 확정" 버튼 추가:

```tsx
// paidAt이 없는 항목에만 노출
{!expense.paidAt && canPay && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => handlePay(expense.id)}
  >
    지급 확정
  </Button>
)}

// paidAt이 있는 항목은 배지로 표시
{expense.paidAt && (
  <Badge variant="default">
    지급완료 {new Date(expense.paidAt).toLocaleDateString('ko-KR')}
  </Badge>
)}
```

```typescript
// operating-expense.service.ts (FE)
markPaid: (id: number) => api.patch(`/operating-expenses/${id}/pay`)
```

### 6-3. BudgetDetailPage — 가용예산 상세 표시

`lineBreakdown` 데이터로 카테고리별 잔액 테이블 추가:

```tsx
// 헤더 레벨 요약
<div className="grid grid-cols-3 gap-4">
  <StatCard label="승인예산" value={budget.approvedBudget} />
  <StatCard label="집행예정" value={budget.commitment} />
  <StatCard label="실집행" value={budget.actual} />
  <StatCard label="가용예산" value={budget.available} highlight />
</div>

// 카테고리별 라인 잔액
<table>
  {budget.lineBreakdown.map(line => (
    <tr key={line.id}>
      <td>{line.category ?? line.description}</td>
      <td>{line.amount.toLocaleString()}원</td>
      <td>{line.spent.toLocaleString()}원</td>
      <td className={line.remaining < 0 ? 'text-red-500' : ''}>
        {line.remaining.toLocaleString()}원
      </td>
    </tr>
  ))}
</table>
```

### 6-4. 초과 시 에러 처리 (Q9=C)

`OperatingExpense` 생성 시 `BUDGET_EXCEEDED` 에러 처리:

```tsx
const handleCreate = async () => {
  try {
    await operatingExpenseApi.create({ ...form })
    toast.success('지출이 등록됐습니다.')
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'BUDGET_EXCEEDED') {
      // 강제 등록 확인 다이얼로그
      setOverrideDialogOpen(true)
    } else {
      toast.error(e instanceof Error ? e.message : '등록 실패')
    }
  }
}

// 강제 등록 다이얼로그
<Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
  <DialogContent>
    <DialogHeader><DialogTitle>예산 초과</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">
      해당 카테고리 예산을 초과합니다. 초과 사유를 입력하면 강제 등록됩니다.
    </p>
    <Textarea
      value={overrideReason}
      onChange={e => setOverrideReason(e.target.value)}
      placeholder="초과 사유를 입력하세요"
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>취소</Button>
      <Button
        variant="destructive"
        disabled={!overrideReason.trim()}
        onClick={() => handleCreate(overrideReason)}
      >
        강제 등록
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 7. 파일 변경 맵

| 파일 | 변경 |
|------|------|
| `prisma/schema.prisma` | `OperatingExpense`에 `paidAt`, `paidById` 추가 |
| `prisma/migrations/…` | migration SQL |
| `src/operating-expense/operating-expense.repo.ts` | `markPaid()`, `findById()` 추가 |
| `src/operating-expense/operating-expense.service.ts` | `markPaid()` 추가, `create()` 하드 Block 로직 수정 |
| `src/operating-expense/operating-expense.routes.ts` | `PATCH /:id/pay` 추가 |
| `src/budget-control/budget-control.repo.ts` | `sumCommitmentAndActual()` 추가 |
| `src/budget-control/budget-control.service.ts` | `getAvailableBudget()` vault 공식으로 업데이트 |
| `src/financial-report/financial-report.routes.ts` | `GET /prev-season-revenue` 추가 |
| `src/apiRouter.ts` | 변경 없음 (기존 라우터 확장) |
| `football/src/types/operating-expense.ts` | `paidAt`, `paidById` 필드 추가 |
| `football/src/services/operatingExpense.service.ts` | `markPaid()` 추가 |
| `football/src/services/financialReport.service.ts` | `getPrevSeasonRevenue()` 추가 |
| `football/src/pages/finance/BudgetListPage.tsx` | 전년도 수익 힌트 추가 |
| `football/src/pages/finance/BudgetDetailPage.tsx` | commitment/actual/lineBreakdown 표시 |
| `football/src/pages/finance/OperatingExpensePage.tsx` | 지급 확정 버튼 + 초과 강제 등록 다이얼로그 |

---

## 8. 구현 순서

1. **Migration** — `paidAt`, `paidById` 컬럼 추가
2. **BE: markPaid** — `PATCH /operating-expenses/:id/pay`
3. **BE: 하드 Block** — `create()` 초과 시 400 + overrideReason 우회
4. **BE: getAvailableBudget** — vault 공식으로 업데이트
5. **BE: prev-season-revenue** — 전년도 수익 힌트 API
6. **FE: 지급 확정 버튼** — OperatingExpensePage
7. **FE: 강제 등록 다이얼로그** — 초과 시 overrideReason 입력
8. **FE: 가용예산 상세** — BudgetDetailPage lineBreakdown
9. **FE: 전년도 수익 힌트** — BudgetListPage 다이얼로그

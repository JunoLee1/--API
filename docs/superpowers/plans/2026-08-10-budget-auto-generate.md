# 이번 시즌 가용예산 자동 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 전년도 카테고리별 실제 지출을 기반으로 이번 시즌 운영비 예산 플랜(`totalOperatingBudget`, `contingencyReserve`, 카테고리별 `mandatoryMinimum`)을 자동 생성하는 기능 추가.

**Architecture:** BE에 `POST /financial-reports/:seasonId/budget/auto-generate` 엔드포인트 추가. 전년도 실적(`getActuals`)을 읽어 `growthRate` 비율 적용 후 `upsertBudgetPlan`으로 저장. FE의 `BudgetPlanPage`에 플랜 없을 때 자동 생성 버튼, 있을 때 확인 다이얼로그 노출.

**Tech Stack:** Express + Prisma (BE), React + react-i18next (FE), Jest (test)

---

## File Structure

**Backend (modify only):**
- `apps/api/src/financial-report/financial-report.service.ts` — `autoGenerateBudgetPlan()` 메서드 추가
- `apps/api/src/financial-report/financial-report.controller.ts` — `autoGenerateBudget` 핸들러 추가
- `apps/api/src/financial-report/financial-report.routes.ts` — `POST /:seasonId/budget/auto-generate` 라우트 추가
- `apps/api/__test__/budget/auto-generate.service.test.ts` — 서비스 유닛 테스트 (신규)

**Frontend (modify only):**
- `football/src/services/financial-report.service.ts` — `budgetPlanApi.autoGenerate()` 추가
- `football/src/pages/admin/BudgetPlanPage.tsx` — 자동 생성 버튼 + 다이얼로그 추가
- `football/src/locales/ko/admin.json` — 한국어 i18n 키 추가
- `football/src/locales/en/admin.json` — 영어 i18n 키 추가

---

### Task 1: BE 서비스 — `autoGenerateBudgetPlan` 메서드

**Files:**
- Create: `apps/api/__test__/budget/auto-generate.service.test.ts`
- Modify: `apps/api/src/financial-report/financial-report.service.ts`

**Context:**
- `OperatingCategory` enum 값: `MEDICAL | MEAL | TRAVEL | EQUIPMENT | SCOUTING | YOUTH`
- `getActuals(seasonId)` 이미 존재 — `Record<string, number>` 반환 (카테고리별 실제 지출)
- `upsertBudgetPlan(seasonId, dto)` 이미 존재 — `UpsertBudgetPlanDto` 받아서 저장
- 계산식:
  ```
  mandatoryMinimum[cat] = prevActuals[cat] * (1 + growthRate)  // 실적 없으면 0
  totalOperatingBudget = sum(mandatoryMinimum) * (1 + contingencyRate)
  contingencyReserve = totalOperatingBudget * contingencyRate
  ```
- `prevSeasonId`는 서비스 메서드가 직접 탐색: 현재 시즌보다 `endDate`가 이전인 시즌 중 가장 최근 것

- [x] **Step 1: 테스트 파일 작성 (실패 확인용)**

```typescript
// apps/api/__test__/budget/auto-generate.service.test.ts
import { FinancialReportService } from "../../src/financial-report/financial-report.service";
import { FinancialReportRepository } from "../../src/financial-report/financial-report.repo";
import { KnapsackService } from "../../src/budget/knapsack.service";

const ALL_CATS = ["MEDICAL", "MEAL", "TRAVEL", "EQUIPMENT", "SCOUTING", "YOUTH"];

function makeRepo(overrides: Partial<FinancialReportRepository> = {}): FinancialReportRepository {
  return {
    findBySeasonId: jest.fn(),
    upsert: jest.fn(),
    upsertBudgetPlan: jest.fn().mockResolvedValue({}),
    getBudgetPlan: jest.fn(),
    saveOptimizeResult: jest.fn(),
    addOverrideLog: jest.fn(),
    getActuals: jest.fn(),
    ...overrides,
  } as unknown as FinancialReportRepository;
}

describe("FinancialReportService.autoGenerateBudgetPlan", () => {
  it("전년도 실적에 growthRate 적용하여 mandatoryMinimum 계산", async () => {
    const prismaSeasonFindFirst = jest.fn().mockResolvedValue({ id: 1, endDate: new Date("2025-12-31") });
    jest.mock("../../src/lib/prisma", () => ({
      getPrisma: () => ({
        season: {
          findUnique: jest.fn().mockResolvedValue({ endDate: new Date("2026-12-31") }),
          findFirst: prismaSeasonFindFirst,
        },
      }),
    }));

    const prevActuals = { MEDICAL: 10_000_000, MEAL: 5_000_000, TRAVEL: 0, EQUIPMENT: 3_000_000, SCOUTING: 0, YOUTH: 2_000_000 };
    const repo = makeRepo({ getActuals: jest.fn().mockResolvedValue(prevActuals) });
    const svc = new FinancialReportService(repo, new KnapsackService());

    await svc.autoGenerateBudgetPlan(2, { growthRate: 0.1, contingencyRate: 0 });

    const callArg = (repo.upsertBudgetPlan as jest.Mock).mock.calls[0][1];
    expect(callArg.categories.find((c: any) => c.category === "MEDICAL").mandatoryMinimum).toBe(11_000_000);
    expect(callArg.categories.find((c: any) => c.category === "MEAL").mandatoryMinimum).toBe(5_500_000);
    expect(callArg.categories.find((c: any) => c.category === "TRAVEL").mandatoryMinimum).toBe(0);
  });

  it("contingencyRate 적용하여 totalOperatingBudget, contingencyReserve 계산", async () => {
    const prevActuals = { MEDICAL: 10_000_000, MEAL: 0, TRAVEL: 0, EQUIPMENT: 0, SCOUTING: 0, YOUTH: 0 };
    const repo = makeRepo({ getActuals: jest.fn().mockResolvedValue(prevActuals) });
    const svc = new FinancialReportService(repo, new KnapsackService());

    await svc.autoGenerateBudgetPlan(2, { growthRate: 0, contingencyRate: 0.1 });

    const callArg = (repo.upsertBudgetPlan as jest.Mock).mock.calls[0][1];
    // mandatoryTotal = 10_000_000
    // totalOperatingBudget = 10_000_000 * 1.1 = 11_000_000
    // contingencyReserve = 11_000_000 * 0.1 = 1_100_000
    expect(callArg.totalOperatingBudget).toBe(11_000_000);
    expect(callArg.contingencyReserve).toBe(1_100_000);
  });

  it("전년도 실적이 없는 카테고리 목록 반환", async () => {
    const prevActuals = { MEDICAL: 5_000_000, MEAL: 0, TRAVEL: 0, EQUIPMENT: 0, SCOUTING: 0, YOUTH: 0 };
    const repo = makeRepo({ getActuals: jest.fn().mockResolvedValue(prevActuals) });
    const svc = new FinancialReportService(repo, new KnapsackService());

    const result = await svc.autoGenerateBudgetPlan(2, { growthRate: 0.1, contingencyRate: 0 });

    expect(result.zeroCategories).toContain("MEAL");
    expect(result.zeroCategories).toContain("TRAVEL");
    expect(result.zeroCategories).not.toContain("MEDICAL");
  });

  it("전년도 시즌이 없으면 PREV_SEASON_NOT_FOUND 에러", async () => {
    const repo = makeRepo({ getActuals: jest.fn() });
    const svc = new FinancialReportService(repo, new KnapsackService());

    // prevSeason findFirst returns null
    jest.mock("../../src/lib/prisma", () => ({
      getPrisma: () => ({
        season: {
          findUnique: jest.fn().mockResolvedValue({ endDate: new Date("2026-12-31") }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      }),
    }));

    await expect(svc.autoGenerateBudgetPlan(2, { growthRate: 0.1 })).rejects.toMatchObject({ code: "PREV_SEASON_NOT_FOUND" });
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd apps/api && npx jest __test__/budget/auto-generate.service.test.ts --no-coverage 2>&1 | tail -20
```
Expected: `autoGenerateBudgetPlan is not a function` 또는 `method does not exist` 류 에러

- [x] **Step 3: 서비스에 `autoGenerateBudgetPlan` 추가**

`apps/api/src/financial-report/financial-report.service.ts`의 `getActuals` 메서드 바로 아래에 추가:

```typescript
async autoGenerateBudgetPlan(
  seasonId: number,
  opts: { growthRate?: number; contingencyRate?: number }
) {
  const { growthRate = 0.1, contingencyRate = 0 } = opts;
  const prisma = getPrisma();

  // 현재 시즌의 endDate 조회
  const currentSeason = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { endDate: true },
  });
  if (!currentSeason) throw new AppError(404, "SEASON_NOT_FOUND");

  // 직전 시즌 탐색 (endDate 기준 현재보다 이전, 가장 최근)
  const prevSeason = await prisma.season.findFirst({
    where: { endDate: { lt: currentSeason.endDate } },
    orderBy: { endDate: "desc" },
    select: { id: true },
  });
  if (!prevSeason) throw new AppError(404, "PREV_SEASON_NOT_FOUND");

  const prevActuals = (await this.repo.getActuals(prevSeason.id)) ?? {};

  const ALL_CATS: OperatingCategory[] = ["MEDICAL", "MEAL", "TRAVEL", "EQUIPMENT", "SCOUTING", "YOUTH"];
  const zeroCategories: OperatingCategory[] = [];

  const categories = ALL_CATS.map((cat) => {
    const actual = prevActuals[cat] ?? 0;
    if (actual === 0) zeroCategories.push(cat);
    return {
      category: cat,
      mandatoryMinimum: Math.round(actual * (1 + growthRate)),
      tiers: [] as { name: string; cost: number; value: number }[],
    };
  });

  const mandatoryTotal = categories.reduce((s, c) => s + c.mandatoryMinimum, 0);
  const totalOperatingBudget = Math.round(mandatoryTotal * (1 + contingencyRate));
  const contingencyReserve = Math.round(totalOperatingBudget * contingencyRate);

  await this.repo.upsertBudgetPlan(seasonId, {
    totalOperatingBudget,
    contingencyReserve,
    categories,
  });

  return { totalOperatingBudget, contingencyReserve, categories, zeroCategories };
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd apps/api && npx jest __test__/budget/auto-generate.service.test.ts --no-coverage 2>&1 | tail -20
```
Expected: `4 tests passed`

> **Note:** Prisma mock이 module 레벨 mock으로 제대로 주입이 안 되면 통합 테스트 방식으로 전환. 테스트 실패 시 `jest.spyOn(prismaModule, 'getPrisma')` 방식으로 조정.

- [x] **Step 5: 커밋**

```bash
git add apps/api/src/financial-report/financial-report.service.ts apps/api/__test__/budget/auto-generate.service.test.ts
git commit -m "feat: add autoGenerateBudgetPlan service method with growth/contingency rates"
```

---

### Task 2: BE 컨트롤러 + 라우트

**Files:**
- Modify: `apps/api/src/financial-report/financial-report.controller.ts`
- Modify: `apps/api/src/financial-report/financial-report.routes.ts`

- [x] **Step 1: 컨트롤러에 `autoGenerateBudget` 핸들러 추가**

`apps/api/src/financial-report/financial-report.controller.ts`의 `setFromPrevSeason` 메서드 바로 아래에 추가:

```typescript
autoGenerateBudget = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole } = requireUser(req);
    if (!canWrite(role, frontOfficeRole)) throw new AppError(403, "FORBIDDEN");
    const seasonId = Number(req.params["seasonId"]);
    const { growthRate, contingencyRate } = req.body as { growthRate?: number; contingencyRate?: number };
    const result = await this.service.autoGenerateBudgetPlan(seasonId, { growthRate, contingencyRate });
    res.status(200).json(result);
  } catch (err) { next(err); }
};
```

- [x] **Step 2: 라우트에 엔드포인트 추가**

`apps/api/src/financial-report/financial-report.routes.ts`의 `router.post("/:seasonId/budget/override", ...)` 라인 바로 뒤에 추가:

```typescript
router.post("/:seasonId/budget/auto-generate", auth, controller.autoGenerateBudget);
```

최종 routes 파일:
```typescript
router.post("/:seasonId",                         auth, controller.set);
router.post("/:seasonId/from-prev-season",        auth, controller.setFromPrevSeason);
router.put("/:seasonId/revenue",                  auth, controller.setBreakdown);
router.post("/:seasonId/csv",                     auth, upload.single("file"), controller.setFromCSV);
router.get("/:seasonId/pl",                       auth, controller.getPnL);
router.get("/:seasonId/with-ledger",              auth, controller.getWithLedger);
router.get("/:seasonId",                          auth, controller.get);
router.get("/:seasonId/budget",                   auth, controller.getBudgetPlan);
router.put("/:seasonId/budget",                   auth, controller.upsertBudgetPlan);
router.post("/:seasonId/budget/optimize",         auth, controller.optimize);
router.post("/:seasonId/budget/override",         auth, controller.addOverride);
router.post("/:seasonId/budget/auto-generate",    auth, controller.autoGenerateBudget);
```

- [x] **Step 3: TS 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -v "^$"
```
Expected: 출력 없음 (에러 없음)

- [x] **Step 4: 커밋**

```bash
git add apps/api/src/financial-report/financial-report.controller.ts apps/api/src/financial-report/financial-report.routes.ts
git commit -m "feat: add POST budget/auto-generate endpoint"
```

---

### Task 3: FE API 서비스 + i18n 키

**Files:**
- Modify: `football/src/services/financial-report.service.ts`
- Modify: `football/src/locales/ko/admin.json`
- Modify: `football/src/locales/en/admin.json`

**Context:**
- `budgetPlanApi` 객체가 이미 있음 (`football/src/services/financial-report.service.ts:90`)
- 응답 타입: `{ totalOperatingBudget: number, contingencyReserve: number, categories: [...], zeroCategories: string[] }`

- [x] **Step 1: `AutoGenerateResult` 타입을 `football/src/types/budget.ts`에 추가**

파일 끝에 추가:

```typescript
export interface AutoGenerateResult {
  totalOperatingBudget: number
  contingencyReserve: number
  categories: { category: OperatingCategory; mandatoryMinimum: number }[]
  zeroCategories: OperatingCategory[]
}
```

- [x] **Step 2: `budgetPlanApi`에 `autoGenerate` 추가**

`football/src/services/financial-report.service.ts`의 `budgetPlanApi` 객체 끝에 추가:

```typescript
  autoGenerate: (seasonId: number, payload: { growthRate: number; contingencyRate?: number }) =>
    api.post<AutoGenerateResult>(`/financial-reports/${seasonId}/budget/auto-generate`, payload),
```

import에도 타입 추가:
```typescript
import type { BudgetPlan, UpsertBudgetPlanPayload, OptimizeResult, AutoGenerateResult } from '@/types/budget'
```

- [x] **Step 3: 한국어 i18n 키 추가**

`football/src/locales/ko/admin.json`의 `"budget"` 섹션에 추가:

```json
"autoGenerate": "자동 생성",
"autoGenerateConfirmTitle": "예산 플랜 덮어쓰기",
"autoGenerateConfirmDesc": "기존 예산 플랜이 있습니다. 자동 생성으로 덮어쓸까요?",
"autoGenerateConfirm": "덮어쓰기",
"autoGenerateCancel": "취소",
"growthRate": "성장률 (%)",
"contingencyRateLabel": "예비비 비율 (%, 0이면 예비비 없음)",
"autoGenerating": "생성 중...",
"autoGenerated": "예산 플랜이 자동 생성되었습니다.",
"autoGenerateFailed": "자동 생성에 실패했습니다.",
"zeroCategoriesWarning": "실적 없는 카테고리 (최소치 0으로 설정):"
```

- [x] **Step 4: 영어 i18n 키 추가**

`football/src/locales/en/admin.json`의 `"budget"` 섹션에 추가:

```json
"autoGenerate": "Auto Generate",
"autoGenerateConfirmTitle": "Overwrite Budget Plan",
"autoGenerateConfirmDesc": "A budget plan already exists. Overwrite with auto-generated values?",
"autoGenerateConfirm": "Overwrite",
"autoGenerateCancel": "Cancel",
"growthRate": "Growth Rate (%)",
"contingencyRateLabel": "Contingency Rate (%, 0 = no reserve)",
"autoGenerating": "Generating...",
"autoGenerated": "Budget plan auto-generated successfully.",
"autoGenerateFailed": "Auto generation failed.",
"zeroCategoriesWarning": "Categories with no prior data (set to 0):"
```

- [x] **Step 5: TS 컴파일 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | grep -v "^$"
```
Expected: 출력 없음

- [x] **Step 6: 커밋**

```bash
git add football/src/types/budget.ts football/src/services/financial-report.service.ts football/src/locales/ko/admin.json football/src/locales/en/admin.json
git commit -m "feat: add autoGenerate API client and i18n keys for budget auto-generation"
```

---

### Task 4: FE BudgetPlanPage — 자동 생성 UI

**Files:**
- Modify: `football/src/pages/admin/BudgetPlanPage.tsx`

**Context:**
- 현재 `plan` state: `BudgetPlan | null`. `null`이면 플랜 없음
- 현재 `seasonId` state: `number | null`
- `budgetPlanApi.get()` 호출 후 플랜 로드
- Dialog 컴포넌트: `@/components/ui/dialog` (이미 프로젝트에 존재)
- 필요한 import: `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter`

**동작:**
1. 자동 생성 버튼 클릭
   - 플랜 없음 → 바로 입력 폼 다이얼로그 열기
   - 플랜 있음 → 덮어쓰기 확인 다이얼로그 먼저
2. 입력 폼: `growthRate` (기본 10), `contingencyRate` (기본 0)
3. 생성 완료 후: `budgetPlanApi.get(seasonId)`로 플랜 재로드, 폼 상태도 업데이트

- [x] **Step 1: import에 Dialog 추가 및 state 추가**

현재 import 블록 끝에 추가:
```typescript
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { budgetPlanApi } from '@/services/financial-report.service'
```
(이미 `budgetPlanApi` import 있으면 생략)

`BudgetPlanPage` 컴포넌트 내 state 블록 끝에 추가:
```typescript
const [autoGenDialog, setAutoGenDialog] = useState<'closed' | 'confirm' | 'form'>('closed')
const [autoGenRate, setAutoGenRate] = useState('10')
const [autoGenContingency, setAutoGenContingency] = useState('0')
const [autoGenerating, setAutoGenerating] = useState(false)
const [zeroWarnings, setZeroWarnings] = useState<string[]>([])
```

- [x] **Step 2: `handleAutoGenerate` 핸들러 추가**

`handleOverride` 함수 바로 다음에 추가:

```typescript
const handleAutoGenerate = async () => {
  if (!seasonId) return
  setAutoGenerating(true)
  try {
    const result = await budgetPlanApi.autoGenerate(seasonId, {
      growthRate: parseFloat(autoGenRate) / 100,
      contingencyRate: parseFloat(autoGenContingency) / 100 || undefined,
    })
    setZeroWarnings(result.zeroCategories)
    const p = await budgetPlanApi.get(seasonId)
    setPlan(p)
    setTotalBudget(p.totalOperatingBudget?.toString() ?? '')
    setContingency(p.contingencyReserve?.toString() ?? '0')
    const newCats = defaultCategories()
    for (const cp of p.budgetCategoryPlans) {
      newCats[cp.category] = {
        mandatoryMinimum: cp.mandatoryMinimum.toString(),
        tiers: cp.tiers.length > 0
          ? cp.tiers.map((tier) => ({ name: tier.name, cost: tier.cost.toString(), value: tier.value.toString() }))
          : defaultTiers(),
      }
    }
    setCategories(newCats)
    setAutoGenDialog('closed')
    toast.success(t('budget.autoGenerated'))
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t('budget.autoGenerateFailed'))
  } finally { setAutoGenerating(false) }
}
```

- [x] **Step 3: 자동 생성 버튼을 페이지 상단에 추가**

`<div className="border-b px-6 py-4">` 블록 안, `<p className="text-sm ...">` 바로 아래에 추가:

```tsx
<div className="mt-2">
  <Button
    size="sm"
    variant="outline"
    onClick={() => setAutoGenDialog(plan ? 'confirm' : 'form')}
  >
    {t('budget.autoGenerate')}
  </Button>
</div>
```

- [x] **Step 4: 경고 배너 추가**

`<div className="px-6 py-4 space-y-6 max-w-4xl">` 안, 첫 번째 `<section>` 바로 위에 추가:

```tsx
{zeroWarnings.length > 0 && (
  <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm text-yellow-800">
    {t('budget.zeroCategoriesWarning')}{' '}
    {zeroWarnings.map((c) => OPERATING_CATEGORY_LABEL[c as OperatingCategory]).join(', ')}
  </div>
)}
```

- [x] **Step 5: 다이얼로그 두 개 추가**

페이지 return의 최상위 `<div>` 닫는 태그 바로 전에 추가:

```tsx
{/* 덮어쓰기 확인 다이얼로그 */}
<Dialog open={autoGenDialog === 'confirm'} onOpenChange={(o) => !o && setAutoGenDialog('closed')}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{t('budget.autoGenerateConfirmTitle')}</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">{t('budget.autoGenerateConfirmDesc')}</p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setAutoGenDialog('closed')}>{t('budget.autoGenerateCancel')}</Button>
      <Button onClick={() => setAutoGenDialog('form')}>{t('budget.autoGenerateConfirm')}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* 파라미터 입력 다이얼로그 */}
<Dialog open={autoGenDialog === 'form'} onOpenChange={(o) => !o && setAutoGenDialog('closed')}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{t('budget.autoGenerate')}</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>{t('budget.growthRate')}</Label>
        <CurrencyInput value={autoGenRate} onChange={setAutoGenRate} placeholder="10" />
      </div>
      <div className="space-y-1.5">
        <Label>{t('budget.contingencyRateLabel')}</Label>
        <CurrencyInput value={autoGenContingency} onChange={setAutoGenContingency} placeholder="0" />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setAutoGenDialog('closed')}>{t('budget.autoGenerateCancel')}</Button>
      <Button onClick={handleAutoGenerate} disabled={autoGenerating}>
        {autoGenerating ? t('budget.autoGenerating') : t('budget.autoGenerate')}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [x] **Step 6: TS 컴파일 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | grep -v "^$"
```
Expected: 출력 없음

- [x] **Step 7: 커밋**

```bash
git add football/src/pages/admin/BudgetPlanPage.tsx
git commit -m "feat: add auto-generate button and dialog to BudgetPlanPage"
```

---

## Self-Review

**Spec coverage:**
- ✅ `POST /financial-reports/:seasonId/budget/auto-generate` 엔드포인트
- ✅ `growthRate` + `contingencyRate` 파라미터 (contingencyRate 선택, 기본 0)
- ✅ 전년도 시즌 자동 탐색 (endDate 기준)
- ✅ 카테고리별 `mandatoryMinimum = prevActuals × (1 + growthRate)`
- ✅ 실적 0인 카테고리 → 0으로 설정 + `zeroCategories` 경고 목록 반환
- ✅ `totalOperatingBudget = mandatoryTotal × (1 + contingencyRate)`
- ✅ `contingencyReserve = totalOperatingBudget × contingencyRate`
- ✅ BudgetPlanPage: 플랜 없으면 버튼 → 바로 폼 다이얼로그
- ✅ BudgetPlanPage: 플랜 있으면 버튼 → 확인 다이얼로그 → 폼 다이얼로그
- ✅ 실적 없는 카테고리 경고 배너

**Placeholder scan:** 없음 — 모든 단계에 실제 코드 포함

**Type consistency:**
- `AutoGenerateResult.zeroCategories: OperatingCategory[]` → 서비스 반환 `OperatingCategory[]` ✅
- `CurrencyInput` — Task 3 이전에 이미 구현되어 있음 ✅
- `budgetPlanApi.autoGenerate` import → Task 3에서 추가 ✅

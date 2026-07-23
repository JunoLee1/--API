# 의무보고서(MEDICAL Report) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부상 통계 페이지에서 의무보고서(MEDICAL 타입 Report)를 빠르게 작성할 수 있도록 Sheet를 교체하고, ReportType에 MEDICAL을 추가해 기존 GM 결재 워크플로우에 통합한다.

**Architecture:** 기존 `Report` 테이블에 `ReportType.MEDICAL`을 추가해 워크플로우 재사용. InjuryStatsPage의 의료비 Sheet를 의무보고서 Sheet로 교체하고, 현재 부상 통계 데이터를 content에 자동 삽입하는 버튼을 제공한다.

**Tech Stack:** TypeScript, Prisma 7, Express 5, React 18, shadcn/ui

---

## 파일 구조

**BE**
- Modify: `apps/api/prisma/schema.prisma` — `ReportType` enum에 `MEDICAL` 추가
- Create: `apps/api/prisma/migrations/20260715000002_add_medical_report_type/migration.sql`

**FE**
- Modify: `football/src/types/report.ts` — `ReportType`에 `'MEDICAL'` 추가, label/style 맵
- Modify: `football/src/pages/reports/ReportFormPage.tsx` — TYPES 배열에 `'MEDICAL'` 추가
- Modify: `football/src/pages/injuries/InjuryStatsPage.tsx` — 의료비 Sheet → 의무보고서 Sheet 교체

---

### Task 1: BE — ReportType enum 확장 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260715000002_add_medical_report_type/migration.sql`

- [x] **Step 1: schema.prisma의 ReportType enum에 MEDICAL 추가**

`apps/api/prisma/schema.prisma` 에서 아래 블록을 찾아:

```prisma
enum ReportType {
  FINANCIAL
  PERFORMANCE
}
```

다음으로 교체:

```prisma
enum ReportType {
  FINANCIAL
  PERFORMANCE
  MEDICAL
}
```

- [x] **Step 2: 마이그레이션 디렉토리 생성 및 SQL 작성**

```bash
mkdir -p apps/api/prisma/migrations/20260715000002_add_medical_report_type
```

`apps/api/prisma/migrations/20260715000002_add_medical_report_type/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "ReportType" ADD VALUE 'MEDICAL';
```

- [x] **Step 3: 마이그레이션 적용 및 Prisma client 재생성**

```bash
cd apps/api
npx prisma migrate resolve --applied 20260715000002_add_medical_report_type
npx prisma db execute --file prisma/migrations/20260715000002_add_medical_report_type/migration.sql
npx prisma generate
```

Expected: `✔ Generated Prisma Client` 메시지.

- [x] **Step 4: BE 타입 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep "report"
```

Expected: 출력 없음 (report 관련 에러 없음).

- [x] **Step 5: 커밋**

```bash
git add apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations/20260715000002_add_medical_report_type/
git commit -m "feat: add MEDICAL to ReportType enum"
```

---

### Task 2: FE — report.ts 타입 + label/style 확장

**Files:**
- Modify: `football/src/types/report.ts`

- [x] **Step 1: ReportType에 'MEDICAL' 추가**

`football/src/types/report.ts` 에서:

```typescript
export type ReportType = 'FINANCIAL' | 'PERFORMANCE'
```

를 다음으로 교체:

```typescript
export type ReportType = 'FINANCIAL' | 'PERFORMANCE' | 'MEDICAL'
```

- [x] **Step 2: REPORT_TYPE_LABEL에 MEDICAL 추가**

```typescript
export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  FINANCIAL: '재무',
  PERFORMANCE: '성과',
  MEDICAL: '의무보고서',
}
```

- [x] **Step 3: REPORT_TYPE_STYLE에 MEDICAL 추가**

```typescript
export const REPORT_TYPE_STYLE: Record<ReportType, string> = {
  FINANCIAL: 'border-purple-300 text-purple-700 bg-purple-50',
  PERFORMANCE: 'border-orange-300 text-orange-700 bg-orange-50',
  MEDICAL: 'border-teal-300 text-teal-700 bg-teal-50',
}
```

- [x] **Step 4: FE 타입 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | grep "report"
```

Expected: 출력 없음.

- [x] **Step 5: 커밋**

```bash
git add football/src/types/report.ts
git commit -m "feat: add MEDICAL ReportType label and style"
```

---

### Task 3: FE — ReportFormPage TYPES 배열 확장

**Files:**
- Modify: `football/src/pages/reports/ReportFormPage.tsx`

- [x] **Step 1: TYPES 배열에 'MEDICAL' 추가**

`football/src/pages/reports/ReportFormPage.tsx` 에서:

```typescript
const TYPES: ReportType[] = ['FINANCIAL', 'PERFORMANCE']
```

를 다음으로 교체:

```typescript
const TYPES: ReportType[] = ['FINANCIAL', 'PERFORMANCE', 'MEDICAL']
```

- [x] **Step 2: FE 타입 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -5
```

Expected: 출력 없음.

- [x] **Step 3: 커밋**

```bash
git add football/src/pages/reports/ReportFormPage.tsx
git commit -m "feat: expose MEDICAL type in report form"
```

---

### Task 4: FE — InjuryStatsPage Sheet 교체 (의료비 → 의무보고서)

**Files:**
- Modify: `football/src/pages/injuries/InjuryStatsPage.tsx`

현재 InjuryStatsPage는 의료비 등록 Sheet를 포함한다. 이를 MEDICAL 타입 보고서 빠른 작성 Sheet로 교체한다. "현재 통계 삽입" 버튼을 누르면 아래 형식의 텍스트가 content textarea에 삽입된다:

```
## 부상 현황 요약 (YYYY-MM-DD)
- 현재 활성 부상: N건
- 평균 회복 기간: N일
- 총 부상 기록: N건

### 부상 부위별
- 부위명: N건
...

### 발생 원인별
- 원인명: N건
...
```

- [x] **Step 1: import 정리 — 의료비 관련 제거, report 관련 추가**

`football/src/pages/injuries/InjuryStatsPage.tsx` 상단 import를 다음으로 교체:

```typescript
import { useEffect, useState } from 'react'
import { injuryApi } from '@/services/injury.service'
import { reportApi } from '@/services/report.service'
import { Skeleton } from '@/components/ui/skeleton'
import { CAUSE_LABEL } from '@/types/injury'
import type { InjuryCause } from '@/types/injury'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, ClipboardList } from 'lucide-react'
```

- [x] **Step 2: 컴포넌트 상태 및 로직 교체**

`InjuryStatsPage` 컴포넌트 안의 상태 선언 및 핸들러를 다음으로 교체:

기존 코드 (아래 블록 전체 제거):
```typescript
  const { user } = useCurrentUser()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receiptDate, setReceiptDate] = useState('')
  const [costCategory, setCostCategory] = useState<ExpenseCostCategory>('OUTPATIENT')
  const [totalAmount, setTotalAmount] = useState('')
  const [payerType, setPayerType] = useState<ExpensePayerType>('CLUB')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | undefined>()

  const isMedical = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL'

  const resetForm = () => {
    setReceiptDate(''); setCostCategory('OUTPATIENT'); setTotalAmount('')
    setPayerType('CLUB'); setDescription(''); setFile(undefined)
  }

  const handleSave = async (andSubmit: boolean) => {
    if (!receiptDate || !totalAmount) { toast.error('날짜와 금액을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto = { receiptDate, costCategory, totalAmount: Number(totalAmount), payerType, description: description || undefined, file }
      const saved = await medicalExpenseApi.create(dto)
      if (andSubmit) {
        await medicalExpenseApi.submit(saved.id)
        toast.success('의료비가 상신됐습니다.')
      } else {
        toast.success('의료비 초안이 저장됐습니다.')
      }
      setSheetOpen(false)
      resetForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }
```

새 코드로 교체:
```typescript
  const { user } = useCurrentUser()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const isMedical = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'MEDICAL'

  const resetForm = () => { setTitle(''); setContent('') }

  const insertStatsSnapshot = () => {
    if (!stats) return
    const bodyPartEntries = Object.entries(stats.byBodyPart).sort(([, a], [, b]) => b - a)
    const causeEntries = Object.entries(stats.byCause).sort(([, a], [, b]) => b - a)
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    const totalCount = bodyPartEntries.reduce((s, [, n]) => s + n, 0)

    const lines: string[] = [
      `## 부상 현황 요약 (${today})`,
      `- 현재 활성 부상: ${stats.activeCount}건`,
      `- 평균 회복 기간: ${stats.avgRecoveryDays != null ? `${stats.avgRecoveryDays}일` : '데이터 없음'}`,
      `- 총 부상 기록: ${totalCount}건`,
    ]
    if (bodyPartEntries.length > 0) {
      lines.push('', '### 부상 부위별')
      bodyPartEntries.forEach(([part, count]) => lines.push(`- ${part}: ${count}건`))
    }
    if (causeEntries.length > 0) {
      lines.push('', '### 발생 원인별')
      causeEntries.forEach(([cause, count]) => {
        const label = CAUSE_LABEL[cause as InjuryCause] ?? cause
        lines.push(`- ${label}: ${count}건`)
      })
    }

    setContent((prev) => (prev ? prev + '\n\n' + lines.join('\n') : lines.join('\n')))
  }

  const handleSave = async (andSubmit: boolean) => {
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (!content.trim()) { toast.error('내용을 입력해주세요.'); return }
    setSaving(true)
    try {
      const report = await reportApi.create({ type: 'MEDICAL', title: title.trim(), content: content.trim() })
      if (andSubmit) {
        await reportApi.submit(report.id)
        toast.success('의무보고서가 상신됐습니다.')
      } else {
        toast.success('의무보고서 초안이 저장됐습니다.')
      }
      setSheetOpen(false)
      resetForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }
```

- [x] **Step 3: 헤더 버튼 레이블 교체**

기존:
```tsx
        {isMedical && (
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />의료비 등록
          </Button>
        )}
```

교체:
```tsx
        {isMedical && (
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <ClipboardList className="h-4 w-4 mr-1" />의무보고서 작성
          </Button>
        )}
```

- [x] **Step 4: Sheet 내용 교체**

기존 Sheet 전체 (`<Sheet open={sheetOpen} ...>...</Sheet>`)를 다음으로 교체:

```tsx
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) resetForm() }}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>의무보고서 작성</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input
                placeholder="예: 2026-07 부상 현황 보고"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>내용 *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={insertStatsSnapshot}
                  disabled={!stats}
                >
                  현재 통계 삽입
                </Button>
              </div>
              <Textarea
                placeholder="부상 현황, 의견, 조치 사항 등을 입력해주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? '저장 중...' : '임시 저장'}
              </Button>
              <Button className="flex-1" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? '처리 중...' : '상신'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
```

- [x] **Step 5: FE 타입 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -10
```

Expected: 출력 없음.

- [x] **Step 6: 커밋**

```bash
git add football/src/pages/injuries/InjuryStatsPage.tsx
git commit -m "feat: replace medical expense Sheet with medical duty report Sheet in InjuryStatsPage"
```

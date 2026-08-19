# Guardian Portal 잔여 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 보호자 포털의 미완성 4개 기능을 구현한다.

**배경 (그릴 2026-08-19 결정사항):**
- Lite Mode = 회비/결제 기능만 차단 (현재 구현 이미 맞음)
- 학교팀 = Club.isLite:true 구단으로 생성
- 성장보고서 보호자 뷰: BE 준비됨, FE 탭 미구현
- 보호자 코드 연동 플로우: BE 준비됨, FE 완전 미구현
- 영수증: alert() → 새 탭 링크
- 대시보드 GUARDIAN 리다이렉트: 이미 수정됨 ✅

**Tech Stack:** React + TypeScript (Vite), Tailwind, shadcn/ui

---

## File Map

**Modify:**
- `football/src/services/guardian.service.ts` — getGrowthReports() 추가
- `football/src/pages/youth/GuardianPortalPage.tsx` — growth 탭 + 코드 입력 UI
- `football/src/pages/youth/GuardianFeeView.tsx` — alert() → 새 탭 링크
- `football/src/pages/youth/YouthRegistrationPage.tsx` — 초대코드 발급 버튼

---

## Task 1: 보호자 성장보고서 탭

**Files:**
- Modify: `football/src/services/guardian.service.ts`
- Modify: `football/src/pages/youth/GuardianPortalPage.tsx`

- [x] **Step 1: guardian.service.ts에 getGrowthReports() 추가**

`football/src/services/guardian.service.ts`에 import 및 타입 추가:

```typescript
export interface GrowthEvaluation {
  id: number
  year: number
  month: number
  attitude: number
  fundamentals: number
  spatialAwareness: number
  physical: number
  comment: string | null
  publishedAt: string | null
  coachName: string
}
```

API 호출 추가:

```typescript
getGrowthReports: (playerId: string) =>
  api.get<GrowthEvaluation[]>(`/growth-reports/player/${playerId}`),
```

- [x] **Step 2: GuardianPortalPage.tsx에 growth 탭 추가**

state 추가:
```typescript
const [growthReports, setGrowthReports] = useState<GrowthEvaluation[]>([])
```

useEffect에 추가:
```typescript
guardianApi.getGrowthReports(selectedId).then(setGrowthReports),
```

TabsTrigger 추가:
```tsx
<TabsTrigger value="growth">{t('guardianPortal.tabs.growth')}</TabsTrigger>
```

TabsContent 추가 (GrowthRadarChart + 히스토리 리스트):
```tsx
<TabsContent value="growth" className="mt-4 space-y-4">
  {growthReports.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t('guardianPortal.growth.empty')}</p>
  ) : (
    <>
      {/* 최신 평가 레이더 차트 */}
      <div className="border rounded-lg p-4">
        <p className="text-sm font-medium mb-3">{t('guardianPortal.growth.latest')}</p>
        <GrowthRadarChart evaluation={growthReports[0]} />
      </div>
      {/* 히스토리 */}
      <div className="space-y-2">
        {growthReports.map(r => (
          <div key={r.id} className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.year}년 {r.month}월</span>
              <span className="text-xs text-muted-foreground">{r.coachName}</span>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>태도 {r.attitude}</span>
              <span>기초 {r.fundamentals}</span>
              <span>공간 {r.spatialAwareness}</span>
              <span>체력 {r.physical}</span>
            </div>
            {r.comment && <p className="text-xs text-foreground">{r.comment}</p>}
          </div>
        ))}
      </div>
    </>
  )}
</TabsContent>
```

`GrowthRadarChart` import 추가:
```typescript
import { GrowthRadarChart } from '@/components/player/GrowthRadarChart'
```

- [x] **Step 3: TypeScript 빌드 확인**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit 2>&1 | head -20
```

GrowthRadarChart props 타입 맞지 않으면 맞게 수정 (파일 읽고 props 확인)

- [x] **Step 4: Commit**

```bash
git add football/src/services/guardian.service.ts football/src/pages/youth/GuardianPortalPage.tsx
git commit -m "feat(guardian): add growth report tab with radar chart and history"
```

---

## Task 2: 보호자 코드 연동 플로우

**Files:**
- Modify: `football/src/pages/youth/GuardianPortalPage.tsx`
- Modify: `football/src/pages/youth/YouthRegistrationPage.tsx`

- [x] **Step 1: guardian.service.ts에 코드 연동 API 추가**

```typescript
linkByCode: (code: string) =>
  api.post<void>('/guardians/link/code', { code }),

issueInviteCode: (playerId: string) =>
  api.post<{ code: string; expiresAt: string }>('/guardians/invite-code', { playerId }),
```

- [x] **Step 2: GuardianPortalPage.tsx — 자녀 없을 때 코드 입력 UI**

자녀가 없는 경우(`children.length === 0`)의 렌더링을 교체:

```tsx
if (children.length === 0) {
  return <GuardianLinkCodeForm onLinked={() => window.location.reload()} />
}
```

`GuardianLinkCodeForm` 컴포넌트 (같은 파일에 추가):

```tsx
function GuardianLinkCodeForm({ onLinked }: { onLinked: () => void }) {
  const { t } = useTranslation('youth')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleLink = async () => {
    if (!code.trim()) return
    setSubmitting(true)
    try {
      await guardianApi.linkByCode(code.trim())
      toast.success(t('guardianPortal.link.success'))
      onLinked()
    } catch {
      toast.error(t('guardianPortal.link.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-sm mx-auto space-y-4">
      <p className="text-muted-foreground text-sm">{t('guardianPortal.link.description')}</p>
      <div className="flex gap-2">
        <Input
          placeholder={t('guardianPortal.link.codePlaceholder')}
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleLink()}
        />
        <Button onClick={() => void handleLink()} disabled={submitting || !code.trim()}>
          {submitting ? '...' : t('guardianPortal.link.submit')}
        </Button>
      </div>
    </div>
  )
}
```

- [x] **Step 3: YouthRegistrationPage.tsx — 어드민 초대코드 발급 버튼**

`YouthRegistrationPage`에서 등록된 유소년 선수 목록 행에 "초대코드 발급" 버튼 추가:

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={async () => {
    const result = await guardianApi.issueInviteCode(player.id)
    toast.success(`초대코드: ${result.code} (유효기간: ${new Date(result.expiresAt).toLocaleDateString('ko-KR')})`)
  }}
>
  초대코드
</Button>
```

단, 보호자가 이미 연동된 선수(`player.guardianId !== null`)에는 표시하지 않음.

- [x] **Step 4: Commit**

```bash
git add football/src/services/guardian.service.ts football/src/pages/youth/GuardianPortalPage.tsx football/src/pages/youth/YouthRegistrationPage.tsx
git commit -m "feat(guardian): add invite code issue (admin) and link-by-code (guardian) flow"
```

---

## Task 3: 영수증 링크 수정

**Files:**
- Modify: `football/src/pages/youth/GuardianFeeView.tsx`

- [x] **Step 1: handleViewReceipt alert() → 새 탭 링크로 교체**

`GuardianFeeView.tsx`에서 `handleViewReceipt` 함수 전체를 제거하고, 영수증 버튼을 `<a>` 태그로 교체:

```tsx
{fee.status === 'PAID' && fee.receiptIssuedAt && (
  <a
    href={`/academy-fees/${fee.id}/receipt`}
    target="_blank"
    rel="noopener noreferrer"
    className="text-xs text-blue-500 underline whitespace-nowrap"
  >
    영수증
  </a>
)}
```

- [x] **Step 2: Commit**

```bash
git add football/src/pages/youth/GuardianFeeView.tsx
git commit -m "fix(guardian): replace receipt alert with proper receipt page link"
```

---

## Task 4: 전체 빌드 확인

- [x] **Step 1: TypeScript 빌드**

```bash
cd /Users/juno/work/football/football
npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음

- [x] **Step 2: Final Commit (필요 시)**

```bash
git add -A
git commit -m "feat(guardian): complete guardian portal — growth tab, code linking, receipt link"
```

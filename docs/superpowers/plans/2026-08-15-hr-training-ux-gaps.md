# HR·훈련 UX 공백 보완 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 채용 충원률 표시(S2), 출결 정정 이력 모달(Y2), HR 보고서 페널티 섹션(Y5) 3개 미구현 항목을 완성한다.

**Architecture:** S2는 기존 BE 엔드포인트(`/recruitment/headcount-progress`)에 FE만 연결. Y2는 `admin.repo.listAuditLogs`에 `targetId` 필터 추가 + `training.repo.findResults`에 `hasCorrectionHistory` 병합 + FE 모달. Y5는 `ops-report.service`에 `getPenaltyStatus` 집계 메서드 신규 추가 + FE 섹션.

**Tech Stack:** Hono + Prisma (BE), React + shadcn/ui + i18n (FE), Jest (테스트)

**스펙:** `docs/superpowers/specs/2026-08-15-hr-training-ux-gaps-design.md`

---

## 파일 맵

| 파일 | 변경 종류 | 항목 |
|------|-----------|------|
| `apps/api/src/admin/admin.repo.ts` | 수정 | Y2 — `listAuditLogs` `targetId` 필터 추가 |
| `apps/api/src/admin/admin.controller.ts` | 수정 | Y2 — `listAuditLogs` 컨트롤러 `targetId` 쿼리 파라미터 추가 |
| `apps/api/src/training/training.repo.ts` | 수정 | Y2 — `findResults`에 `hasCorrectionHistory` 병합 |
| `apps/api/src/training/training.service.ts` | 수정 | Y2 — `getResults` 반환 타입 명시 |
| `apps/api/src/ops-report/ops-report.service.ts` | 수정 | Y5 — `getPenaltyStatus` 추가 |
| `apps/api/src/ops-report/ops-report.controller.ts` | 수정 | Y5 — `getPenaltyStatus` 컨트롤러 추가 |
| `apps/api/src/ops-report/ops-report.routes.ts` | 수정 | Y5 — `/penalty-status` 라우트 추가 |
| `apps/api/src/ops-report/ops-report.service.test.ts` | 수정 | Y5 — `getPenaltyStatus` 테스트 |
| `football/src/services/recruitment.service.ts` | 수정 | S2 — `headcountProgress()` 추가 |
| `football/src/pages/admin/recruitment/JobPostingListPage.tsx` | 수정 | S2 — Progress UI |
| `football/src/services/admin.service.ts` | 수정 | Y2 — `auditLogApi.list` `targetId` 파라미터 추가 |
| `football/src/pages/training/TrainingResultsPage.tsx` | 수정 | Y2 — 정정 이력 배지 + Dialog |
| `football/src/services/ops-report.service.ts` | 수정 | Y5 — `getPenaltyStatus()` 추가 |
| `football/src/pages/admin/HrReportPage.tsx` | 수정 | Y5 — 페널티 섹션 추가 |

---

## Task 1: S2 — FE 충원률 UI

> BE `GET /recruitment/headcount-progress`는 완성됨. FE 연결만 필요.

**Files:**
- Modify: `football/src/services/recruitment.service.ts`
- Modify: `football/src/pages/admin/recruitment/JobPostingListPage.tsx`

---

- [ ] **Step 1: FE 서비스에 타입 + 함수 추가**

`football/src/services/recruitment.service.ts` 상단 인터페이스 블록에 추가:

```typescript
export interface HeadcountProgressItem {
  postingId: number
  title: string
  targetHeadcount: number
  hiredCount: number
  fillRate: number          // 0-100
  status: string
}
```

기존 `recruitmentApi` 객체에 함수 추가:

```typescript
headcountProgress: (): Promise<HeadcountProgressItem[]> =>
  api.get('/recruitment/headcount-progress'),
```

---

- [ ] **Step 2: JobPostingListPage에 진행률 상태 + 데이터 패칭 추가**

`JobPostingListPage.tsx`에서 기존 state 선언 블록에 추가:

```typescript
const [progressMap, setProgressMap] = useState<Map<number, HeadcountProgressItem>>(new Map())
```

기존 `useEffect` 안 또는 별도 `useEffect`에 추가 (기존 공고 목록 fetch와 병렬):

```typescript
useEffect(() => {
  recruitmentApi.headcountProgress()
    .then(items => setProgressMap(new Map(items.map(i => [i.postingId, i]))))
    .catch(() => {})  // 실패 시 진행률 섹션 미노출, 목록은 유지
}, [])
```

---

- [ ] **Step 3: 카드에 Progress UI 렌더링**

각 공고 카드 (`{t('recruitment.headcount')}: {p.headcount}명` 이 있는 `<p>` 바로 아래)에 추가:

```typescript
import { Progress } from '@/components/ui/progress'

// 카드 내부 (headcount 표시 바로 아래):
{(() => {
  const prog = progressMap.get(p.id)
  if (!prog || prog.targetHeadcount === 0) return null
  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t('recruitment.fillRate')}</span>
        <span>{prog.hiredCount}/{prog.targetHeadcount}{t('common.person')}</span>
      </div>
      <Progress value={prog.fillRate} className="h-1.5" />
    </div>
  )
})()}
```

i18n 키 추가 (ko.json, en.json):
```json
// ko.json
"fillRate": "충원 현황"
// en.json
"fillRate": "Fill Rate"
```

---

- [ ] **Step 4: 커밋**

```bash
git add football/src/services/recruitment.service.ts \
        football/src/pages/admin/recruitment/JobPostingListPage.tsx
git commit -m "feat(s2): 채용 공고 충원률 Progress UI 추가"
```

---

## Task 2: Y2 BE — Audit Log targetId 필터 + training hasCorrectionHistory

> `AuditLog.targetId`는 `String?` 타입임. 쿼리 시 `String(resultId)` 변환 필요.

**Files:**
- Modify: `apps/api/src/admin/admin.repo.ts` (L115–147 `listAuditLogs` 함수)
- Modify: `apps/api/src/admin/admin.controller.ts` (L137–152 `listAuditLogs` 컨트롤러)
- Modify: `apps/api/src/training/training.repo.ts` (`findResults` 함수)

---

- [ ] **Step 1: admin.repo.ts — `listAuditLogs`에 `targetId` 필터 추가**

`listAuditLogs` 함수 시그니처 변경:

```typescript
// Before:
async listAuditLogs(
  filters: { actorId?: number; action?: string; from?: string; to?: string },
  limit = 50,
  page = 1,
)

// After:
async listAuditLogs(
  filters: { actorId?: number; action?: string; from?: string; to?: string; targetId?: string },
  limit = 50,
  page = 1,
)
```

`where` 구성 블록에 추가:

```typescript
// 기존 where 스프레드 마지막에 추가:
...(filters.targetId !== undefined ? { targetId: filters.targetId } : {}),
```

`countAuditLogs`도 동일한 시그니처 변경 및 where 추가.

---

- [ ] **Step 2: admin.controller.ts — `listAuditLogs`에서 `targetId` 쿼리 파라미터 읽기**

기존 `listAuditLogs` 컨트롤러에서 쿼리 파라미터를 읽는 부분에 `targetId` 추가:

```typescript
// 기존 코드 (actorId, action, from, to를 q에서 읽음) 아래에 추가:
const targetId = q['targetId'] as string | undefined

// 기존 filters 객체 구성 부분을 다음으로 교체:
const filters = {
  ...(actorId ? { actorId: Number(actorId) } : {}),
  ...(action ? { action } : {}),
  ...(from ? { from } : {}),
  ...(to ? { to } : {}),
  ...(targetId ? { targetId } : {}),
}
```

---

- [ ] **Step 3: training.repo.ts — `findResults`에 `hasCorrectionHistory` 병합**

`findResults` 함수 마지막 부분 (results 반환 직전)에 추가:

```typescript
// 기존 Prisma 쿼리로 results 얻은 후:
if (results.length === 0) return []

const corrected = await this.prisma.auditLog.findMany({
  where: {
    action: 'ATTENDANCE_CORRECTED',
    targetId: { in: results.map(r => String(r.id)) },
  },
  select: { targetId: true },
  distinct: ['targetId'],
})
const correctedSet = new Set(corrected.map(c => c.targetId))

return results.map(r => ({
  ...r,
  hasCorrectionHistory: correctedSet.has(String(r.id)),
}))
```

`findResults` 반환 타입을 추론으로 두거나, 명시적으로 `hasCorrectionHistory: boolean`이 포함된 타입으로 변경.

---

- [ ] **Step 4: 동작 확인 (수동)**

```bash
cd /Users/juno/work/football
# BE 빌드 오류 없는지 확인
npx tsc --project apps/api/tsconfig.json --noEmit
```

Expected: 에러 없음

---

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/admin/admin.repo.ts \
        apps/api/src/admin/admin.controller.ts \
        apps/api/src/training/training.repo.ts
git commit -m "feat(y2): audit-log targetId 필터 + training hasCorrectionHistory"
```

---

## Task 3: Y2 FE — 정정 이력 모달

**Files:**
- Modify: `football/src/services/admin.service.ts`
- Modify: `football/src/pages/training/TrainingResultsPage.tsx`

---

- [ ] **Step 1: FE admin.service — `auditLogApi.list`에 `targetId` 추가**

`football/src/services/admin.service.ts`의 `auditLogApi.list` 함수가 받는 params 타입에 `targetId?: number` 추가:

```typescript
// auditLogApi.list 파라미터 타입에 추가:
list: (params: {
  page?: number
  limit?: number
  actorId?: number
  action?: string
  from?: string
  to?: string
  targetId?: number   // 추가
}): Promise<{ logs: AuditLogEntry[]; total: number }> =>
  api.get(`/admin/audit-logs?${new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString()}`),
```

`AuditLogEntry` 타입에 `detail: string` (JSON 문자열) 필드가 없다면 추가:

```typescript
export interface AuditLogEntry {
  id: number
  actorId: number
  action: string
  targetId: string | null
  detail: string | null   // JSON 문자열
  createdAt: string
  actor: { username: string; nickname?: string; role: string }
}
```

---

- [ ] **Step 2: TrainingResultsPage — 정정 이력 상태 추가**

기존 state 블록에 추가:

```typescript
const [historyTarget, setHistoryTarget] = useState<{
  id: number
  playerName: string
  sessionDate: string
} | null>(null)
const [historyLogs, setHistoryLogs] = useState<AuditLogEntry[]>([])
const [historyLoading, setHistoryLoading] = useState(false)
```

이력 로드 핸들러:

```typescript
const handleOpenHistory = async (row: { id: number; player: { playerName: string }; session: { date: string } }) => {
  setHistoryTarget({ id: row.id, playerName: row.player.playerName, sessionDate: row.session.date })
  setHistoryLoading(true)
  setHistoryLogs([])
  try {
    const res = await auditLogApi.list({ targetId: row.id, action: 'ATTENDANCE_CORRECTED', limit: 50 })
    setHistoryLogs(res.logs)
  } catch {
    // Dialog 내 에러 텍스트로 표시
  } finally {
    setHistoryLoading(false)
  }
}
```

---

- [ ] **Step 3: 테이블 행에 배지 추가**

각 행 렌더링에서, 기존 출결 상태 표시 옆에 조건부 배지 추가:

```typescript
// row.hasCorrectionHistory가 true일 때만 표시
{row.hasCorrectionHistory && (
  <button
    onClick={() => handleOpenHistory(row)}
    className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
  >
    {t('resultsPage.corrected')}
  </button>
)}
```

i18n 키:
```json
// ko.json
"corrected": "수정됨 ↕"
// en.json
"corrected": "Edited ↕"
```

---

- [ ] **Step 4: 정정 이력 Dialog 추가**

기존 정정 Dialog 아래(또는 별도)에 이력 Dialog 추가:

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format } from 'date-fns'

<Dialog open={historyTarget !== null} onOpenChange={open => { if (!open) setHistoryTarget(null) }}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>
        {historyTarget?.playerName} — {historyTarget ? format(new Date(historyTarget.sessionDate), 'yyyy-MM-dd') : ''} 정정 이력
      </DialogTitle>
    </DialogHeader>
    {historyLoading ? (
      <p className="text-sm text-muted-foreground py-4 text-center">{t('common.loading')}</p>
    ) : historyLogs.length === 0 ? (
      <p className="text-sm text-muted-foreground py-4 text-center">{t('resultsPage.noHistory')}</p>
    ) : (
      <ul className="space-y-3">
        {historyLogs.map(log => {
          const detail = log.detail ? JSON.parse(log.detail) as { before: string; after: string; reason: string } : null
          return (
            <li key={log.id} className="border rounded p-3 text-sm space-y-0.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{log.actor.nickname ?? log.actor.username}</span>
                <span>{format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}</span>
              </div>
              {detail && (
                <p className="font-medium">
                  {detail.before ?? '미입력'} → {detail.after}
                </p>
              )}
              {detail?.reason && (
                <p className="text-muted-foreground">{t('resultsPage.reason')}: {detail.reason}</p>
              )}
            </li>
          )
        })}
      </ul>
    )}
  </DialogContent>
</Dialog>
```

i18n 키:
```json
// ko.json
"noHistory": "정정 이력이 없습니다",
"reason": "사유"
// en.json
"noHistory": "No correction history",
"reason": "Reason"
```

---

- [ ] **Step 5: 커밋**

```bash
git add football/src/services/admin.service.ts \
        football/src/pages/training/TrainingResultsPage.tsx
git commit -m "feat(y2): 출결 정정 이력 모달"
```

---

## Task 4: Y5 BE — getPenaltyStatus 엔드포인트

> `drillAttendance`와 동일한 2단계 쿼리 + 메모리 집계 패턴. `teamId`는 JWT 컨텍스트에서 가져옴.

**Files:**
- Modify: `apps/api/src/ops-report/ops-report.service.ts`
- Modify: `apps/api/src/ops-report/ops-report.controller.ts`
- Modify: `apps/api/src/ops-report/ops-report.routes.ts`
- Modify: `apps/api/src/ops-report/ops-report.service.test.ts`

---

- [ ] **Step 1: 테스트 먼저 작성**

`ops-report.service.test.ts`에 `getPenaltyStatus` describe 블록 추가:

```typescript
describe('getPenaltyStatus', () => {
  const mockSessions = [{ id: 1 }, { id: 2 }]
  const mockResults = [
    // 선수 A: absentUnauth 3 → effectiveAbsences 3 → TRIGGERED
    { playerId: 'p1', attendance: 'ABSENT_UNAUTHORIZED', player: { playerName: '김민준', team: { id: 10 } } },
    { playerId: 'p1', attendance: 'ABSENT_UNAUTHORIZED', player: { playerName: '김민준', team: { id: 10 } } },
    { playerId: 'p1', attendance: 'ABSENT_UNAUTHORIZED', player: { playerName: '김민준', team: { id: 10 } } },
    // 선수 B: absentUnauth 2 → effectiveAbsences 2 → WARNING
    { playerId: 'p2', attendance: 'ABSENT_UNAUTHORIZED', player: { playerName: '이성민', team: { id: 10 } } },
    { playerId: 'p2', attendance: 'ABSENT_UNAUTHORIZED', player: { playerName: '이성민', team: { id: 10 } } },
    // 선수 C: lateUnauth 3 → effectiveAbsences 1 → NORMAL
    { playerId: 'p3', attendance: 'LATE_UNAUTHORIZED', player: { playerName: '박지성', team: { id: 10 } } },
    { playerId: 'p3', attendance: 'LATE_UNAUTHORIZED', player: { playerName: '박지성', team: { id: 10 } } },
    { playerId: 'p3', attendance: 'LATE_UNAUTHORIZED', player: { playerName: '박지성', team: { id: 10 } } },
    // 선수 D: effectiveAbsences 0 → 제외
    { playerId: 'p4', attendance: 'PRESENT', player: { playerName: '손흥민', team: { id: 10 } } },
    // 선수 E: 다른 팀 → 제외
    { playerId: 'p5', attendance: 'ABSENT_UNAUTHORIZED', player: { playerName: 'Other', team: { id: 99 } } },
  ]

  beforeEach(() => {
    mockPrisma.trainingSession.findMany.mockResolvedValue(mockSessions)
    mockPrisma.trainingResult.findMany.mockResolvedValue(mockResults)
  })

  it('effectiveAbsences 기준 내림차순으로 반환한다', async () => {
    const result = await service.getPenaltyStatus(10)
    expect(result[0].playerId).toBe('p1')   // 3회
    expect(result[1].playerId).toBe('p2')   // 2회
    expect(result[2].playerId).toBe('p3')   // 1회
  })

  it('TRIGGERED/WARNING/NORMAL 상태를 올바르게 분류한다', async () => {
    const result = await service.getPenaltyStatus(10)
    const map = Object.fromEntries(result.map(r => [r.playerId, r.status]))
    expect(map['p1']).toBe('TRIGGERED')
    expect(map['p2']).toBe('WARNING')
    expect(map['p3']).toBe('NORMAL')
  })

  it('effectiveAbsences가 0인 선수는 제외한다', async () => {
    const result = await service.getPenaltyStatus(10)
    expect(result.find(r => r.playerId === 'p4')).toBeUndefined()
  })

  it('다른 팀 선수는 제외한다', async () => {
    const result = await service.getPenaltyStatus(10)
    expect(result.find(r => r.playerId === 'p5')).toBeUndefined()
  })

  it('세션이 없으면 빈 배열을 반환한다', async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([])
    const result = await service.getPenaltyStatus(10)
    expect(result).toEqual([])
  })
})
```

---

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/juno/work/football
npx jest apps/api/src/ops-report/ops-report.service.test.ts --no-coverage
```

Expected: `getPenaltyStatus is not a function` 또는 유사한 오류로 FAIL

---

- [ ] **Step 3: ops-report.service.ts에 getPenaltyStatus 구현**

`ops-report.service.ts` 파일에 타입 + 메서드 추가:

```typescript
export interface PenaltyStatusRow {
  playerId: string
  playerName: string
  effectiveAbsences: number
  status: 'TRIGGERED' | 'WARNING' | 'NORMAL'
}

async getPenaltyStatus(teamId: number): Promise<PenaltyStatusRow[]> {
  const sessions = await this.prisma.trainingSession.findMany({
    where: { isApproved: true },
    select: { id: true },
  })
  if (sessions.length === 0) return []

  const sessionIds = sessions.map(s => s.id)
  const results = await this.prisma.trainingResult.findMany({
    where: { sessionId: { in: sessionIds } },
    select: {
      playerId: true,
      attendance: true,
      player: {
        select: {
          playerName: true,
          team: { select: { id: true } },
        },
      },
    },
  })

  const agg = new Map<string, { playerName: string; absentUnauth: number; lateUnauth: number }>()
  for (const r of results) {
    if (r.player.team?.id !== teamId) continue
    if (!agg.has(r.playerId)) {
      agg.set(r.playerId, { playerName: r.player.playerName, absentUnauth: 0, lateUnauth: 0 })
    }
    const a = agg.get(r.playerId)!
    if (r.attendance === 'ABSENT_UNAUTHORIZED') a.absentUnauth++
    else if (r.attendance === 'LATE_UNAUTHORIZED') a.lateUnauth++
  }

  const rows: PenaltyStatusRow[] = []
  for (const [playerId, a] of agg) {
    const effectiveAbsences = a.absentUnauth + Math.floor(a.lateUnauth / 3)
    if (effectiveAbsences === 0) continue
    const status: PenaltyStatusRow['status'] =
      effectiveAbsences % 3 === 0 ? 'TRIGGERED' :
      effectiveAbsences % 3 === 2 ? 'WARNING' : 'NORMAL'
    rows.push({ playerId, playerName: a.playerName, effectiveAbsences, status })
  }

  rows.sort((a, b) => b.effectiveAbsences - a.effectiveAbsences)
  return rows
}
```

---

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/juno/work/football
npx jest apps/api/src/ops-report/ops-report.service.test.ts --no-coverage
```

Expected: 5개 테스트 모두 PASS

---

- [ ] **Step 5: 컨트롤러 + 라우트 추가**

`ops-report.controller.ts`에 메서드 추가:

```typescript
getPenaltyStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { role, frontOfficeRole, teamId } = requireUser(req)
  if (!(role === 'FRONT_OFFICE' && frontOfficeRole === 'HR_MANAGER')) {
    throw new AppError(403, 'FORBIDDEN')
  }
  if (!teamId) throw new AppError(400, 'TEAM_CONTEXT_REQUIRED')
  const data = await this.service.getPenaltyStatus(teamId)
  res.json(data)
}
```

`ops-report.routes.ts`에 라우트 추가 (기존 `/drill/attendance` 근처):

```typescript
router.get('/penalty-status', auth, controller.getPenaltyStatus)
```

---

- [ ] **Step 6: 전체 테스트 확인**

```bash
cd /Users/juno/work/football
npx jest apps/api/src/ops-report/ --no-coverage
```

Expected: 전체 PASS

---

- [ ] **Step 7: 커밋**

```bash
git add apps/api/src/ops-report/ops-report.service.ts \
        apps/api/src/ops-report/ops-report.controller.ts \
        apps/api/src/ops-report/ops-report.routes.ts \
        apps/api/src/ops-report/ops-report.service.test.ts
git commit -m "feat(y5): getPenaltyStatus 집계 엔드포인트"
```

---

## Task 5: Y5 FE — HR 보고서 페널티 섹션

**Files:**
- Modify: `football/src/services/ops-report.service.ts`
- Modify: `football/src/pages/admin/HrReportPage.tsx`

---

- [ ] **Step 1: FE 서비스에 타입 + 함수 추가**

`football/src/services/ops-report.service.ts`에 추가:

```typescript
export interface PenaltyStatusRow {
  playerId: string
  playerName: string
  effectiveAbsences: number
  status: 'TRIGGERED' | 'WARNING' | 'NORMAL'
}

// opsReportApi 객체에 추가:
getPenaltyStatus: (): Promise<PenaltyStatusRow[]> =>
  api.get('/ops-reports/penalty-status'),
```

---

- [ ] **Step 2: HrReportPage에 페널티 상태 추가**

기존 state 블록에 추가:

```typescript
const [penaltyRows, setPenaltyRows] = useState<PenaltyStatusRow[]>([])
const [penaltyLoading, setPenaltyLoading] = useState(false)
const [penaltyError, setPenaltyError] = useState(false)
```

기존 데이터 패칭 `useEffect` 안(또는 별도)에 추가:

```typescript
setPenaltyLoading(true)
opsReportApi.getPenaltyStatus()
  .then(setPenaltyRows)
  .catch(() => setPenaltyError(true))
  .finally(() => setPenaltyLoading(false))
```

---

- [ ] **Step 3: 페널티 섹션 UI 렌더링**

기존 출석 섹션 (`출석률` KPI 카드) 아래에 추가:

```typescript
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// shadcn/ui Badge는 "warning" variant 없음 → className으로 색상 처리
const PENALTY_BADGE = {
  TRIGGERED: { label: '페널티 발동', className: 'bg-destructive text-destructive-foreground' },
  WARNING:   { label: '경고 (임박)', className: 'bg-amber-500 text-white' },
  NORMAL:    { label: '1회 누적',   className: 'bg-secondary text-secondary-foreground' },
}

// 출석 섹션 바로 아래:
<section className="space-y-3">
  <h3 className="text-base font-semibold">{t('hrReport.penaltyStatus')}</h3>
  {penaltyLoading ? (
    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  ) : penaltyError ? (
    <p className="text-sm text-destructive">{t('common.loadError')}</p>
  ) : penaltyRows.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t('hrReport.noPenalty')}</p>
  ) : (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('common.player')}</TableHead>
          <TableHead>{t('hrReport.effectiveAbsences')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {penaltyRows.map(row => (
          <TableRow key={row.playerId}>
            <TableCell className="font-medium">{row.playerName}</TableCell>
            <TableCell>{row.effectiveAbsences}{t('hrReport.times')}</TableCell>
            <TableCell>
              <Badge className={PENALTY_BADGE[row.status].className}>
                {PENALTY_BADGE[row.status].label}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )}
</section>
```

i18n 키:
```json
// ko.json
"penaltyStatus": "실효 결석 누적 현황",
"noPenalty": "페널티 누적 선수 없음",
"effectiveAbsences": "실효 결석",
"times": "회"
// en.json
"penaltyStatus": "Effective Absence Tracker",
"noPenalty": "No penalty accumulations",
"effectiveAbsences": "Effective Absences",
"times": ""
```

---

- [ ] **Step 4: 커밋**

```bash
git add football/src/services/ops-report.service.ts \
        football/src/pages/admin/HrReportPage.tsx
git commit -m "feat(y5): HR 보고서 페널티 섹션"
```

---

## 완료 기준

- [ ] S2: `JobPostingListPage`에서 각 공고 카드에 Progress 바 + "N/M명" 표시
- [ ] Y2: `TrainingResultsPage`에서 정정된 행에 "수정됨 ↕" 배지, 클릭 시 정정 이력 Dialog
- [ ] Y5: `HrReportPage` 출석 섹션 아래 "실효 결석 누적 현황" 테이블 (TRIGGERED/WARNING/NORMAL 배지)
- [ ] `npx jest apps/api/src/ops-report/ops-report.service.test.ts --no-coverage` → 전체 PASS
- [ ] `npx tsc --project apps/api/tsconfig.json --noEmit` → 에러 없음

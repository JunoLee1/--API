# 코치 역할 최적화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수비/공격/골키퍼 코치별 포지션 데이터 필터링, 미니 캘린더 사이드바, 코치 전용 대시보드(차트 + 슬랙/이메일/PDF 보고서)를 FE 전용으로 구현한다.

**Architecture:** 3개의 독립 PR. PR #35: `coachPositionMap.ts` 신설 + `TrainingDetailPage` 포지션 필터. PR #36: `MiniCalendar` 컴포넌트 + `TrainingPage` 사이드바. PR #37: `CoachDashboardPage` 신설 + 라우트/내비게이션 추가. 모든 변경은 FE 전용이며 BE API 변경 없음.

**Tech Stack:** React 19, TypeScript, recharts ^3.9.2, Tailwind CSS v4, lucide-react, sonner (toast)

---

## File Map

| 작업 | 파일 | 상태 |
|------|------|------|
| Task 1 | `football/src/lib/coachPositionMap.ts` | 신설 |
| Task 2 | `football/src/pages/training/TrainingDetailPage.tsx` | 수정 |
| Task 3 | `football/src/components/ui/mini-calendar.tsx` | 신설 |
| Task 4 | `football/src/pages/training/TrainingPage.tsx` | 수정 |
| Task 5 | `football/src/pages/training/CoachDashboardPage.tsx` | 신설 |
| Task 6 | `football/src/App.tsx` | 수정 |
| Task 6 | `football/src/layouts/AppShell.tsx` | 수정 |

---

## Task 1: coachPositionMap.ts 신설

**Files:**
- Create: `football/src/lib/coachPositionMap.ts`

- [x] **Step 1: 파일 생성**

```ts
// football/src/lib/coachPositionMap.ts
import type { CoachingRole } from '@/types/auth'
import type { Position } from '@/types/player'

export const COACH_POSITION_MAP: Partial<Record<CoachingRole, Position[]>> = {
  DEFENSIVE_COACH: [
    'CENTER_BACK',
    'LEFT_WING_BACK',
    'LEFT_FULL_BACK',
    'RIGHT_WING_BACK',
    'RIGHT_FULL_BACK',
  ],
  ATTACKING_COACH: [
    'STRIKER',
    'SHADOW_STRIKER',
    'WINGER',
    'CENTRAL_ATTACK_MIDFIELDER',
    'RIGHT_ATTACK_MIDFIELDER',
    'LEFT_ATTACK_MIDFIELDER',
  ],
  GOALKEEPER_COACH: ['GOALKEEPER'],
}

export function getCoachPositions(coachingRole: CoachingRole | null | undefined): Position[] | null {
  if (!coachingRole) return null
  return COACH_POSITION_MAP[coachingRole] ?? null
}
```

> **주의:** Position 값은 모두 대문자(`'CENTER_BACK'` 등). `football/src/types/player.ts`의 `Position` 타입과 동일해야 한다.

- [x] **Step 2: TypeScript 컴파일 확인**

```bash
cd football && npx tsc --noEmit
```

에러 없이 통과해야 함.

- [x] **Step 3: 커밋**

```bash
git add football/src/lib/coachPositionMap.ts
git commit -m "feat(training): add COACH_POSITION_MAP for position-based filtering"
```

---

## Task 2: TrainingDetailPage 포지션 필터링

**Files:**
- Modify: `football/src/pages/training/TrainingDetailPage.tsx`

- [x] **Step 1: import 추가**

파일 상단 import 블록에 추가:

```ts
import { getCoachPositions } from '@/lib/coachPositionMap'
import type { Position } from '@/types/player'
import { Switch } from '@/components/ui/switch'
```

- [x] **Step 2: showAll 상태 + isOwnerPos 헬퍼 추가**

`useCurrentUser()` 호출 바로 아래에 추가:

```ts
const coachPositions = getCoachPositions(user?.coachingRole)
const hasPositionFilter = coachPositions !== null

const [showAll, setShowAll] = useState(() => {
  try { return localStorage.getItem('trainingDetail_showAll') === 'true' } catch { return false }
})

const handleShowAllToggle = (v: boolean) => {
  setShowAll(v)
  try { localStorage.setItem('trainingDetail_showAll', String(v)) } catch { /* ignore */ }
}

const isOwnerPos = (pos: string): boolean => {
  if (!hasPositionFilter || showAll) return true
  return coachPositions!.includes(pos as Position)
}
```

- [x] **Step 3: 출석·평가 섹션 헤더에 "전체 보기" 토글 추가**

기존 코드:
```tsx
<h3 className="text-sm font-semibold mb-3">
  출석 · 평가
  <span className="ml-2 text-xs font-normal text-muted-foreground">
    {session.participants.length}명
  </span>
</h3>
```

교체:
```tsx
<div className="flex items-center justify-between mb-3">
  <h3 className="text-sm font-semibold">
    출석 · 평가
    <span className="ml-2 text-xs font-normal text-muted-foreground">
      {session.participants.length}명
    </span>
  </h3>
  {hasPositionFilter && (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
      <Switch checked={showAll} onCheckedChange={handleShowAllToggle} className="scale-75" />
      전체 보기
    </label>
  )}
</div>
```

- [x] **Step 4: TableRow에 포지션 기반 스타일 적용**

기존:
```tsx
{session.participants.map((p) => {
  const pos = p.player.position as Position
  const zone = POSITION_ZONE[pos]
  const input = resultInputs[p.playerId]
  const hasResult = session.results.some((r) => r.playerId === p.playerId)
  return (
    <TableRow key={p.playerId}>
```

교체:
```tsx
{session.participants.map((p) => {
  const pos = p.player.position as Position
  const zone = POSITION_ZONE[pos]
  const input = resultInputs[p.playerId]
  const hasResult = session.results.some((r) => r.playerId === p.playerId)
  const isOwner = isOwnerPos(pos)
  return (
    <TableRow
      key={p.playerId}
      className={!isOwner ? 'opacity-40 pointer-events-none' : undefined}
    >
```

- [x] **Step 5: 비소유 행의 입력 필드를 읽기 전용으로 처리**

`canScore && input ? (...)` 패턴을 가진 3개 필드(출석 Select, 점수 Input, 피드백 Input) 모두:

출석 `<TableCell>`:
```tsx
<TableCell>
  {canScore && input && isOwner ? (
    <Select ... />
  ) : (
    input && (
      <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${ATTENDANCE_STYLE[input.attendance]}`}>
        {ATTENDANCE_LABEL[input.attendance]}
      </span>
    )
  )}
</TableCell>
```

점수 `<TableCell>`:
```tsx
<TableCell className="text-center">
  {canScore && input && isOwner ? (
    <Input type="number" min={1} max={10} ... />
  ) : (
    <span className="tabular-nums text-sm">
      {input?.performanceScore || '—'}
    </span>
  )}
</TableCell>
```

피드백 `<TableCell>`:
```tsx
<TableCell>
  {canScore && input && isOwner ? (
    <Input className="h-7 text-sm" ... />
  ) : (
    <span className="text-sm text-muted-foreground">{input?.feedback || '—'}</span>
  )}
</TableCell>
```

- [x] **Step 6: 개발 서버 실행 후 수동 확인**

```bash
cd football && npm run dev
```

체크리스트:
- DEFENSIVE_COACH로 로그인 → 세션 상세 열기 → CB/WB/FB 선수만 정상, 나머지 행 흐림
- "전체 보기" 켜기 → 모든 행 정상 표시, 비소유 선수 입력은 여전히 비활성
- HEAD_COACH 로그인 → 토글 없음, 전체 정상 표시
- 페이지 새로고침 → localStorage에서 토글 상태 복원

- [x] **Step 7: 커밋**

```bash
git add football/src/pages/training/TrainingDetailPage.tsx
git commit -m "feat(training): position-based participant filter for coaching roles (#35)"
```

---

## Task 3: MiniCalendar 컴포넌트 신설

**Files:**
- Create: `football/src/components/ui/mini-calendar.tsx`

- [x] **Step 1: 파일 생성**

```tsx
// football/src/components/ui/mini-calendar.tsx
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MiniCalendarProps {
  sessionDates: string[]        // 'YYYY-MM-DD' 배열
  selectedDate: string | null   // 'YYYY-MM-DD' 또는 null
  onSelect: (date: string | null) => void
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function MiniCalendar({ sessionDates, selectedDate, onSelect }: MiniCalendarProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed

  const sessionSet = new Set(sessionDates)

  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay = new Date(viewYear, viewMonth + 1, 0)
  const startDow = firstDay.getDay() // 0=일

  const cells: (number | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ]

  const toDateStr = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${viewYear}-${mm}-${dd}`
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long',
  })

  return (
    <div className="w-44 shrink-0 border-r pr-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={prevMonth}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium">{monthLabel}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={nextMonth}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {DAY_LABELS.map(d => (
          <span key={d} className="text-center text-[10px] text-muted-foreground py-0.5">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`empty-${i}`} />
          const dateStr = toDateStr(day)
          const hasSession = sessionSet.has(dateStr)
          const isSelected = selectedDate === dateStr
          return (
            <button
              key={dateStr}
              onClick={() => onSelect(isSelected ? null : dateStr)}
              className={[
                'flex flex-col items-center justify-start rounded text-[11px] py-0.5 leading-none transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'hover:bg-muted',
              ].join(' ')}
            >
              <span>{day}</span>
              {hasSession && (
                <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [x] **Step 2: TypeScript 컴파일 확인**

```bash
cd football && npx tsc --noEmit
```

에러 없이 통과해야 함.

- [x] **Step 3: 커밋**

```bash
git add football/src/components/ui/mini-calendar.tsx
git commit -m "feat(ui): add MiniCalendar component with session dot indicators"
```

---

## Task 4: TrainingPage 레이아웃 업데이트

**Files:**
- Modify: `football/src/pages/training/TrainingPage.tsx`

- [x] **Step 1: MiniCalendar import 추가**

파일 상단 import 블록에 추가:

```ts
import { MiniCalendar } from '@/components/ui/mini-calendar'
```

- [x] **Step 2: selectedDate 상태 추가**

`TrainingPage` 컴포넌트 내 기존 `useState` 선언들 바로 아래에 추가:

```ts
const [selectedDate, setSelectedDate] = useState<string | null>(null)
```

- [x] **Step 3: 날짜 필터 파생 값 추가**

`totalPages` 선언 바로 위에 추가:

```ts
const sessionDates = [...new Set(sessions.map(s => s.date.slice(0, 10)))]

const filteredSessions = selectedDate
  ? sessions.filter(s => s.date.slice(0, 10) === selectedDate)
  : sessions

const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE)
const paged = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
```

> `totalPages`와 `paged` 선언이 기존에 있다면 제거하고 위 코드로 교체.

- [x] **Step 4: 본문 레이아웃을 2컬럼으로 변경**

기존:
```tsx
<div className="flex-1 overflow-auto">
  {loading ? (
    ...
  ) : sessions.length === 0 ? (
    ...
  ) : (
    <Table>
      ...
    </Table>
  )}
</div>
```

교체:
```tsx
<div className="flex-1 overflow-auto flex gap-4 p-4 min-h-0">
  <MiniCalendar
    sessionDates={sessionDates}
    selectedDate={selectedDate}
    onSelect={(d) => { setSelectedDate(d); setPage(1) }}
  />

  <div className="flex-1 min-w-0 overflow-auto">
    {selectedDate && (
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 세션
          {filteredSessions.length === 0 && ' — 없음'}
        </span>
        <button className="text-xs underline" onClick={() => setSelectedDate(null)}>초기화</button>
      </div>
    )}
    {loading ? (
      <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
    ) : filteredSessions.length === 0 ? (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        {selectedDate ? '해당 날짜에 훈련 세션이 없습니다.' : '등록된 훈련 세션이 없습니다.'}
      </div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>날짜</TableHead>
            <TableHead>목표</TableHead>
            <TableHead className="w-32">유형</TableHead>
            <TableHead className="w-24 text-center">승인</TableHead>
            {canApprove && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((s) => (
            <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/training/${s.id}`)}>
              <TableCell className="tabular-nums">{formatDate(s.date)}</TableCell>
              <TableCell className="max-w-xs truncate">{s.goal}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${SESSION_TYPE_STYLE[s.sessionType]}`}>
                  {SESSION_TYPE_LABEL[s.sessionType]}
                </span>
              </TableCell>
              <TableCell className="text-center">
                {s.isApproved
                  ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                  : <Clock className="h-4 w-4 text-muted-foreground mx-auto" />}
              </TableCell>
              {canApprove && (
                <TableCell>
                  {!s.isApproved && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => handleApprove(s.id, e)}>
                      승인
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </div>
</div>
```

- [x] **Step 5: Pagination의 `totalItems`를 `filteredSessions.length`로 수정**

기존:
```tsx
<Pagination
  page={page}
  totalPages={totalPages}
  totalItems={sessions.length}
  ...
```

교체:
```tsx
<Pagination
  page={page}
  totalPages={totalPages}
  totalItems={filteredSessions.length}
  ...
```

- [x] **Step 6: 개발 서버에서 수동 확인**

```bash
cd football && npm run dev
```

체크리스트:
- 훈련 일정 페이지 좌측에 미니 캘린더 노출
- 세션 있는 날짜 아래 점(dot) 표시
- 날짜 클릭 → 해당 날짜 세션만 필터링, 이전/다음 달 이동 가능
- 선택된 날짜 재클릭 또는 "초기화" → 전체 목록 복귀

- [x] **Step 7: 커밋**

```bash
git add football/src/pages/training/TrainingPage.tsx
git commit -m "feat(training): add mini calendar sidebar with date filter (#36)"
```

---

## Task 5: CoachDashboardPage 신설

**Files:**
- Create: `football/src/pages/training/CoachDashboardPage.tsx`

- [x] **Step 1: 파일 생성**

```tsx
// football/src/pages/training/CoachDashboardPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { trainingApi } from '@/services/training.service'
import type { TrainingResultRow, SessionType } from '@/types/training'
import { SESSION_TYPE_LABEL } from '@/types/training'
import type { Position } from '@/types/player'
import { POSITION_LABEL } from '@/types/player'
import { COACHING_ROLE_LABEL } from '@/types/auth'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getCoachPositions } from '@/lib/coachPositionMap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { toast } from 'sonner'
import { Clipboard, Printer } from 'lucide-react'

const PRESENT_STATUSES = new Set(['PRESENT', 'LATE_AUTHORIZED', 'LATE_UNAUTHORIZED'])

function getDefaultRange() {
  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  return { from, to }
}

interface PositionStat {
  position: string
  label: string
  avgScore: number
  attendanceRate: number
  count: number
}

interface PlayerTrend {
  name: string
  data: { date: string; score: number | null }[]
}

function aggregateByPosition(rows: TrainingResultRow[], filterPositions: Position[] | null): PositionStat[] {
  const map: Record<string, { scores: number[]; present: number; total: number }> = {}
  for (const row of rows) {
    const pos = row.player.position as Position
    if (filterPositions && !filterPositions.includes(pos)) continue
    if (!map[pos]) map[pos] = { scores: [], present: 0, total: 0 }
    if (row.performanceScore != null) map[pos].scores.push(row.performanceScore)
    map[pos].total++
    if (PRESENT_STATUSES.has(row.attendance)) map[pos].present++
  }
  return Object.entries(map).map(([pos, stat]) => ({
    position: pos,
    label: POSITION_LABEL[pos as Position] ?? pos,
    avgScore: stat.scores.length > 0
      ? Math.round((stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length) * 10) / 10
      : 0,
    attendanceRate: stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0,
    count: stat.total,
  }))
}

function aggregateSessionTrend(rows: TrainingResultRow[], filterPositions: Position[] | null) {
  const map: Record<string, { present: number; total: number }> = {}
  for (const row of rows) {
    const pos = row.player.position as Position
    if (filterPositions && !filterPositions.includes(pos)) continue
    const date = row.session.date.slice(0, 10)
    if (!map[date]) map[date] = { present: 0, total: 0 }
    map[date].total++
    if (PRESENT_STATUSES.has(row.attendance)) map[date].present++
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stat]) => ({
      date: date.slice(5),
      attendanceRate: stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0,
    }))
}

function aggregatePlayerTrends(rows: TrainingResultRow[], filterPositions: Position[] | null): PlayerTrend[] {
  const playerMap: Record<string, { name: string; sessions: Record<string, number | null> }> = {}
  for (const row of rows) {
    if (row.performanceScore == null) continue
    const pos = row.player.position as Position
    if (filterPositions && !filterPositions.includes(pos)) continue
    const pid = row.player.id
    const date = row.session.date.slice(0, 10)
    if (!playerMap[pid]) playerMap[pid] = { name: row.player.playerName, sessions: {} }
    playerMap[pid].sessions[date] = row.performanceScore
  }
  const allDates = [...new Set(rows.map(r => r.session.date.slice(0, 10)))].sort()
  return Object.values(playerMap)
    .slice(0, 10)
    .map(p => ({
      name: p.name,
      data: allDates.map(d => ({ date: d.slice(5), score: p.sessions[d] ?? null })),
    }))
}

const LINE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

export function CoachDashboardPage() {
  const { user } = useCurrentUser()
  const coachPositions = getCoachPositions(user?.coachingRole)

  const [range, setRange] = useState(getDefaultRange)
  const [positionFilter, setPositionFilter] = useState<'own' | 'all'>('own')
  const [rows, setRows] = useState<TrainingResultRow[]>([])
  const [loading, setLoading] = useState(false)

  const activePositions = (positionFilter === 'own' && coachPositions) ? coachPositions : null

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await trainingApi.getResults({ from: range.from, to: range.to })
      setRows(data)
    } catch {
      toast.error('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { fetchData() }, [fetchData])

  const positionStats = aggregateByPosition(rows, activePositions)
  const sessionTrend = aggregateSessionTrend(rows, activePositions)
  const playerTrends = aggregatePlayerTrends(rows, activePositions)

  const totalSessions = [...new Set(rows.map(r => r.sessionId))].length
  const overallAttendance = rows.length > 0
    ? Math.round((rows.filter(r => PRESENT_STATUSES.has(r.attendance)).length / rows.length) * 100)
    : 0
  const missingData = rows
    .filter(r => r.performanceScore == null)
    .map(r => r.player.playerName)
  const uniqueMissing = [...new Set(missingData)]

  const roleLabel = user?.coachingRole
    ? COACHING_ROLE_LABEL[user.coachingRole]
    : '코치'

  const copySlack = async () => {
    const posLines = positionStats
      .map(p => `  • ${p.label}: ${p.avgScore > 0 ? p.avgScore.toFixed(1) : '—'} / 출석 ${p.attendanceRate}%`)
      .join('\n')
    const missingLine = uniqueMissing.length > 0
      ? uniqueMissing.slice(0, 5).join(', ') + (uniqueMissing.length > 5 ? ` 외 ${uniqueMissing.length - 5}명` : '')
      : '없음'

    const text = [
      `📊 *[${range.from.slice(0, 7)} 훈련 리포트]* — ${roleLabel}`,
      `📅 기간: ${range.from} – ${range.to} | 세션 수: ${totalSessions}회`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👥 포지션별 평균 점수 / 출석률`,
      posLines,
      `📋 전체 출석률: ${overallAttendance}%`,
      `⚠️ 미평가 선수: ${missingLine}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      toast.success('슬랙용 텍스트가 복사됐습니다.')
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  const copyEmail = async () => {
    const header = `포지션`.padEnd(24) + `평균 점수`.padEnd(12) + `출석률`
    const divider = '-'.repeat(44)
    const rows_ = positionStats
      .map(p => p.label.padEnd(24) + (p.avgScore > 0 ? p.avgScore.toFixed(1) : '—').padEnd(12) + `${p.attendanceRate}%`)
      .join('\n')
    const missingLine = uniqueMissing.length > 0
      ? uniqueMissing.slice(0, 10).join(', ') + (uniqueMissing.length > 10 ? ` 외 ${uniqueMissing.length - 10}명` : '')
      : '없음'

    const text = [
      `제목: [${range.from.slice(0, 7)} 훈련 결과 보고] ${roleLabel}`,
      '',
      `[요약]`,
      `기간: ${range.from} ~ ${range.to}, 총 ${totalSessions}회 세션 진행`,
      '',
      `[포지션별 지표]`,
      header,
      divider,
      rows_,
      '',
      `[코치 코멘트]`,
      `(작성 필요)`,
      '',
      `[누락 데이터 알림]`,
      missingLine,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      toast.success('이메일용 텍스트가 복사됐습니다.')
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0 print:hidden">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">코치 대시보드</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{roleLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copySlack} disabled={rows.length === 0}>
            <Clipboard className="h-3.5 w-3.5 mr-1" />슬랙용 복사
          </Button>
          <Button variant="outline" size="sm" onClick={copyEmail} disabled={rows.length === 0}>
            <Clipboard className="h-3.5 w-3.5 mr-1" />이메일용 복사
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={rows.length === 0}>
            <Printer className="h-3.5 w-3.5 mr-1" />PDF 인쇄
          </Button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="border-b px-6 py-3 flex flex-wrap gap-4 items-end shrink-0 bg-muted/30 print:hidden">
        <div className="space-y-1">
          <Label className="text-xs">시작일</Label>
          <Input
            type="date"
            value={range.from}
            onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">종료일</Label>
          <Input
            type="date"
            value={range.to}
            onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
            className="w-36 h-8 text-sm"
          />
        </div>
        {coachPositions && (
          <div className="space-y-1">
            <Label className="text-xs">포지션 범위</Label>
            <Select value={positionFilter} onValueChange={v => setPositionFilter(v as 'own' | 'all')}>
              <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="own">내 담당만</SelectItem>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button size="sm" onClick={fetchData} disabled={loading} className="h-8">
          {loading ? '조회 중...' : '조회'}
        </Button>
      </div>

      {/* 인쇄 헤더 (화면에선 숨김) */}
      <div className="hidden print:block px-6 py-4 border-b">
        <h1 className="text-xl font-bold">{range.from.slice(0, 7)} 훈련 리포트 — {roleLabel}</h1>
        <p className="text-sm text-muted-foreground">기간: {range.from} ~ {range.to} | 세션 수: {totalSessions}회 | 출석률: {overallAttendance}%</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6 min-h-0">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            해당 기간에 훈련 결과가 없습니다.
          </div>
        ) : (
          <>
            {/* 상단 KPI */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{totalSessions}</p>
                <p className="text-xs text-muted-foreground mt-1">총 세션</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{overallAttendance}%</p>
                <p className="text-xs text-muted-foreground mt-1">전체 출석률</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{uniqueMissing.length}</p>
                <p className="text-xs text-muted-foreground mt-1">미평가 선수</p>
              </div>
            </div>

            {/* 차트 행 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 포지션별 평균 점수 */}
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3">포지션별 평균 점수</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={positionStats} margin={{ top: 4, right: 8, bottom: 24, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => v.toFixed(1)} />
                    <Bar dataKey="avgScore" fill="#3b82f6" name="평균 점수" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 세션별 출석률 추이 */}
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3">세션별 출석률 추이</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={sessionTrend} margin={{ top: 4, right: 8, bottom: 24, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Line type="monotone" dataKey="attendanceRate" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="출석률" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 선수별 점수 추이 */}
            {playerTrends.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3">선수별 점수 추이 (최대 10명)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={playerTrends[0].data.map((d, i) => ({
                      date: d.date,
                      ...Object.fromEntries(playerTrends.map(p => [p.name, p.data[i]?.score])),
                    }))}
                    margin={{ top: 4, right: 8, bottom: 24, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                    {playerTrends.map((p, i) => (
                      <Line
                        key={p.name}
                        type="monotone"
                        dataKey={p.name}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={1.5}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 미평가 선수 알림 */}
            {uniqueMissing.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ 미평가 선수 ({uniqueMissing.length}명)</p>
                <p className="text-xs text-amber-700">{uniqueMissing.join(', ')}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 전역 인쇄 스타일 */}
      <style>{`
        @media print {
          body > * { display: none; }
          #root > * { display: block; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
```

- [x] **Step 2: TypeScript 컴파일 확인**

```bash
cd football && npx tsc --noEmit
```

에러 없이 통과해야 함.

- [x] **Step 3: 커밋**

```bash
git add football/src/pages/training/CoachDashboardPage.tsx
git commit -m "feat(training): add CoachDashboardPage with charts and report copy/print (#37)"
```

---

## Task 6: 라우트 + 내비게이션 등록

**Files:**
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [x] **Step 1: App.tsx에 import 추가**

기존 훈련 import 블록 바로 아래에 추가:

```ts
import { CoachDashboardPage } from '@/pages/training/CoachDashboardPage'
```

- [x] **Step 2: App.tsx에 라우트 추가**

기존 `/training/coach-availability` 라우트 바로 아래에 추가:

```tsx
<Route path="/training/dashboard" element={<CoachDashboardPage />} />
```

> **주의:** `/training/:id` 라우트보다 **위**에 있어야 한다. 현재 `/training/coach-availability` 아래, `/training/:id` 위인 순서를 유지한다.

- [x] **Step 3: AppShell.tsx에 내비게이션 항목 추가**

기존 `coach-availability` 항목 바로 아래에 추가:

```ts
{
  to: '/training/dashboard',
  label: '코치 대시보드',
  icon: BarChart2,
  section: '훈련',
  roles: ['COACHING_STAFF'],
},
```

> `BarChart2`는 AppShell.tsx 상단에서 이미 import 중. `roles: ['COACHING_STAFF']`로 설정하면 COACHING_STAFF 역할만 메뉴에 표시됨.

- [x] **Step 4: TypeScript 컴파일 확인**

```bash
cd football && npx tsc --noEmit
```

에러 없이 통과해야 함.

- [x] **Step 5: 개발 서버에서 수동 확인**

```bash
cd football && npm run dev
```

체크리스트:
- COACHING_STAFF로 로그인 → 훈련 섹션에 "코치 대시보드" 메뉴 표시
- `/training/dashboard` 접속 → 기간 필터, 차트(포지션별 점수 바 차트, 출석률 라인 차트, 선수별 추이) 렌더링
- 날짜 범위 변경 후 "조회" → 새 데이터 반영
- "슬랙용 복사" 클릭 → 클립보드 복사 후 toast 알림, 슬랙에 붙여넣기 확인
- "이메일용 복사" 클릭 → 클립보드 복사 후 toast 알림
- "PDF 인쇄" 클릭 → 브라우저 인쇄 다이얼로그, 필터 바/버튼 숨김 확인
- DEFENSIVE_COACH로 로그인 → "내 담당만" 기본 선택, 수비 포지션 차트만 표시
- ADMIN으로 로그인 → 훈련 섹션에 "코치 대시보드" 메뉴 없음

- [x] **Step 6: 커밋**

```bash
git add football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(training): register /training/dashboard route and nav item"
```

---

## 자기 검토 결과

**스펙 커버리지:**
- ✅ Feature 1: `coachPositionMap.ts` (Task 1) + 포지션 필터 (Task 2)
- ✅ Feature 2: `MiniCalendar` (Task 3) + `TrainingPage` 레이아웃 (Task 4)
- ✅ Feature 3: `CoachDashboardPage` (Task 5) + 라우트/내비 (Task 6)
- ✅ 슬랙용/이메일용 복사 버튼
- ✅ PDF 인쇄(`window.print()` + print CSS)
- ✅ 포지션 범위 토글 (내 담당만 / 전체)
- ✅ 미평가 선수 알림 섹션

**타입 일관성:**
- `getCoachPositions()` — Task 1에서 정의, Task 2·5에서 동일 시그니처로 사용
- `Position` 값 — 모두 `'CENTER_BACK'` 형태 대문자 (player.ts 타입과 일치)
- `TrainingResultRow.player.position` — `string` 타입이므로 `as Position`으로 캐스팅 후 사용 (Task 5 코드에 반영됨)

**플레이스홀더 없음:** 모든 코드 블록 완성.

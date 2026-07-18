# 훈련 결과 조회 탭 & TRAINING 보고서 타입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 훈련 결과를 기간/세션타입별로 조회·CSV 내보내기하는 탭을 추가하고, 보고서에 TRAINING 타입을 추가해 HEAD_COACH가 결재할 수 있도록 한다.

**Architecture:** 두 개의 독립 서브태스크. (A) BE에 훈련 결과 집계 API 추가 → FE 훈련 결과 페이지 신설. (B) Prisma enum에 `TRAINING` 추가 → BE 결재 권한 분기 → FE 타입/레이블 업데이트.

**Tech Stack:** Hono/Express + Prisma (BE), React + shadcn/ui + papaparse (FE, CSV), TypeScript

---

## 파일 맵

### 서브태스크 A — 훈련 결과 조회 탭

| 역할 | 경로 | 변경 |
|------|------|------|
| BE repo | `apps/api/src/training/training.repo.ts` | `findResults()` 추가 |
| BE service | `apps/api/src/training/training.service.ts` | `getResults()` 추가 |
| BE controller | `apps/api/src/training/training.controller.ts` | `getResults` 핸들러 추가 |
| BE routes | `apps/api/src/training/training.routes.ts` | `GET /results` 등록 |
| FE types | `football/src/types/training.ts` | `TrainingResultRow` 타입 추가 |
| FE service | `football/src/services/training.service.ts` | `getResults()` 추가 |
| FE page | `football/src/pages/training/TrainingResultsPage.tsx` | 신규 생성 |
| FE router | `football/src/App.tsx` | `/training/results` 라우트 추가 |

### 서브태스크 B — TRAINING 보고서 타입

| 역할 | 경로 | 변경 |
|------|------|------|
| DB schema | `prisma/schema.prisma` | `ReportType` enum에 `TRAINING` 추가 |
| Migration | `prisma/migrations/` | 자동 생성 |
| BE controller | `apps/api/src/report/report.controller.ts` | 결재 권한 분기 (`isGM || isHeadCoach`) |
| BE service | `apps/api/src/report/report.service.ts` | `approve` 권한 파라미터 추가 |
| FE types | `football/src/types/report.ts` | `TRAINING` 타입·레이블·스타일 추가 |

---

## 서브태스크 A: 훈련 결과 조회 탭

### Task 1: BE — `findResults()` repo 메서드

**Files:**
- Modify: `apps/api/src/training/training.repo.ts`

- [ ] **Step 1: `findResults` 메서드 추가**

`training.repo.ts`의 클래스 마지막에 추가:

```typescript
findResults(filters: {
  from?: string
  to?: string
  sessionType?: string
  playerId?: string
}) {
  const where: Record<string, unknown> = {}

  if (filters.from || filters.to) {
    where.session = {
      date: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to + 'T23:59:59Z') } : {}),
      },
    }
  }

  if (filters.sessionType) {
    where.session = {
      ...(where.session as object ?? {}),
      sessionType: filters.sessionType,
    }
  }

  if (filters.playerId) {
    where.playerId = filters.playerId
  }

  return this.prisma.trainingResult.findMany({
    where: where as any,
    include: {
      session: { select: { id: true, date: true, sessionType: true, goal: true } },
      player: { select: { id: true, name: true, position: true } },
    },
    orderBy: { session: { date: 'desc' } },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/training/training.repo.ts
git commit -m "feat(training): add findResults repo method with date/type/player filters"
```

---

### Task 2: BE — service + controller + route

**Files:**
- Modify: `apps/api/src/training/training.service.ts`
- Modify: `apps/api/src/training/training.controller.ts`
- Modify: `apps/api/src/training/training.routes.ts`

- [ ] **Step 1: service에 `getResults` 추가**

`training.service.ts` 클래스 마지막에:

```typescript
getResults(filters: { from?: string; to?: string; sessionType?: string; playerId?: string }) {
  return this.repo.findResults(filters)
}
```

- [ ] **Step 2: controller에 `getResults` 핸들러 추가**

`training.controller.ts` 클래스 마지막에:

```typescript
getResults = async (req: Request, res: Response) => {
  try {
    const { from, to, sessionType, playerId } = req.query as Record<string, string>
    const results = await this.service.getResults({ from, to, sessionType, playerId })
    res.json(results)
  } catch (e) {
    next(e)
  }
}
```

> `next`가 없다면 컨트롤러 시그니처를 `(req, res, next)` 로 수정하거나 기존 패턴에 맞게 try/catch 처리한다.

- [ ] **Step 3: route 등록**

`training.routes.ts`에서 `router.get("/", ...)` 위에 추가:

```typescript
router.get("/results", auth, controller.getResults);
```

- [ ] **Step 4: 수동 검증**

```bash
curl -s "http://localhost:3000/training/results?from=2026-07-01&to=2026-07-31" \
  -H "Authorization: Bearer <token>" | jq '.[0]'
```

응답에 `session.date`, `session.sessionType`, `player.name`, `attendance`, `performanceScore` 포함 확인.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/training/training.service.ts \
        apps/api/src/training/training.controller.ts \
        apps/api/src/training/training.routes.ts
git commit -m "feat(training): GET /training/results with date/sessionType/player filters"
```

---

### Task 3: FE — 타입 + API 서비스

**Files:**
- Modify: `football/src/types/training.ts`
- Modify: `football/src/services/training.service.ts`

- [ ] **Step 1: `TrainingResultRow` 타입 추가**

`football/src/types/training.ts` 하단에:

```typescript
export interface TrainingResultRow {
  id: number
  attendance: AttendanceStatus
  feedback: string | null
  performanceScore: number | null
  playerId: string
  sessionId: number
  session: {
    id: number
    date: string
    sessionType: SessionType
    goal: string
  }
  player: {
    id: string
    name: string
    position: string
  }
}

export interface TrainingResultFilters {
  from?: string
  to?: string
  sessionType?: SessionType | ''
  playerId?: string
}
```

- [ ] **Step 2: `trainingApi.getResults` 추가**

`football/src/services/training.service.ts`에서 `trainingApi` 객체에:

```typescript
getResults: (filters: TrainingResultFilters) => {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.sessionType) params.set('sessionType', filters.sessionType)
  if (filters.playerId) params.set('playerId', filters.playerId)
  return api.get<TrainingResultRow[]>(`/training/results?${params.toString()}`)
},
```

- [ ] **Step 3: Commit**

```bash
git add football/src/types/training.ts football/src/services/training.service.ts
git commit -m "feat(training): add TrainingResultRow type and getResults API call"
```

---

### Task 4: FE — `TrainingResultsPage.tsx` 신규 생성

**Files:**
- Create: `football/src/pages/training/TrainingResultsPage.tsx`

- [ ] **Step 1: papaparse 설치 확인**

```bash
cd football && grep '"papaparse"' package.json || npm install papaparse @types/papaparse
```

- [ ] **Step 2: 페이지 작성**

`football/src/pages/training/TrainingResultsPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { trainingApi } from '@/services/training.service'
import type { TrainingResultRow, SessionType, TrainingResultFilters } from '@/types/training'
import { SESSION_TYPE_LABEL } from '@/types/training'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Download } from 'lucide-react'
import Papa from 'papaparse'

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: '출석',
  ABSENT_AUTHORIZED: '공결',
  ABSENT_UNAUTHORIZED: '무단결석',
  LATE_AUTHORIZED: '공결지각',
  LATE_UNAUTHORIZED: '무단지각',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function TrainingResultsPage() {
  const [filters, setFilters] = useState<TrainingResultFilters>({ from: '', to: '', sessionType: '' })
  const [rows, setRows] = useState<TrainingResultRow[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const data = await trainingApi.getResults(filters)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [])

  const exportCsv = () => {
    const data = rows.map(r => ({
      날짜: formatDate(r.session.date),
      세션유형: SESSION_TYPE_LABEL[r.session.sessionType] ?? r.session.sessionType,
      선수명: r.player.name,
      포지션: r.player.position,
      출석: ATTENDANCE_LABEL[r.attendance] ?? r.attendance,
      달성도: r.performanceScore ?? '',
      피드백: r.feedback ?? '',
    }))
    const csv = Papa.unparse(data)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `훈련결과_${filters.from ?? ''}_${filters.to ?? ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">훈련 결과</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-1" /> CSV 내보내기
        </Button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label>시작일</Label>
          <Input
            type="date"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <Label>종료일</Label>
          <Input
            type="date"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <Label>세션 유형</Label>
          <Select
            value={filters.sessionType ?? ''}
            onValueChange={v => setFilters(f => ({ ...f, sessionType: v as SessionType | '' }))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map(t => (
                <SelectItem key={t} value={t}>{SESSION_TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetch} disabled={loading}>조회</Button>
      </div>

      {/* 테이블 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>세션 유형</TableHead>
            <TableHead>선수</TableHead>
            <TableHead>포지션</TableHead>
            <TableHead>출석</TableHead>
            <TableHead>달성도</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">로딩 중...</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">데이터 없음</TableCell></TableRow>
          ) : rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{formatDate(r.session.date)}</TableCell>
              <TableCell>{SESSION_TYPE_LABEL[r.session.sessionType] ?? r.session.sessionType}</TableCell>
              <TableCell>{r.player.name}</TableCell>
              <TableCell>{r.player.position}</TableCell>
              <TableCell>{ATTENDANCE_LABEL[r.attendance] ?? r.attendance}</TableCell>
              <TableCell>{r.performanceScore ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add football/src/pages/training/TrainingResultsPage.tsx
git commit -m "feat(training): add TrainingResultsPage with date filter and CSV export"
```

---

### Task 5: FE — 라우터 등록

**Files:**
- Modify: `football/src/App.tsx`

- [ ] **Step 1: import 추가**

`App.tsx` 상단 import 블록에:

```typescript
import { TrainingResultsPage } from '@/pages/training/TrainingResultsPage'
```

- [ ] **Step 2: 라우트 추가**

`/training` 라우트 아래에 (`/training/:id` **위에**):

```typescript
<Route path="/training/results" element={<TrainingResultsPage />} />
```

- [ ] **Step 3: 사이드바 링크 확인**

사이드바/네비에 훈련 메뉴가 있다면 "훈련 결과" 링크(`/training/results`)를 추가한다. 사이드바 파일은 `football/src/layouts/AppShell.tsx` 또는 `Sidebar.tsx`를 찾아 기존 `/training` 링크 아래에 동일 패턴으로 삽입.

- [ ] **Step 4: 수동 검증**

```
브라우저 → /training/results
1. 조회 버튼 클릭 → 테이블에 데이터 노출
2. 날짜 범위 입력 후 조회 → 해당 기간 결과만 표시
3. CSV 내보내기 → 파일 다운로드, Excel에서 UTF-8 BOM 정상 표시 확인
```

- [ ] **Step 5: Commit**

```bash
git add football/src/App.tsx
git commit -m "feat(training): register /training/results route"
```

---

## 서브태스크 B: TRAINING 보고서 타입 + HEAD_COACH 결재

### Task 6: DB — `TRAINING` enum 추가

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: enum 수정**

`prisma/schema.prisma`의 `enum ReportType`:

```prisma
enum ReportType {
  FINANCIAL
  PERFORMANCE
  MEDICAL
  TRAINING
}
```

- [ ] **Step 2: 마이그레이션**

```bash
cd apps/api
npx prisma migrate dev --name add_training_report_type
npx prisma generate
```

Expected: `Migration 20260718..._add_training_report_type applied`.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(report): add TRAINING to ReportType enum"
```

---

### Task 7: BE — HEAD_COACH 결재 권한 분기

**Files:**
- Modify: `apps/api/src/report/report.controller.ts`
- Modify: `apps/api/src/report/report.service.ts`

- [ ] **Step 1: controller에 `isHeadCoach` 헬퍼 추가**

`report.controller.ts` 상단 `isGM` 함수 아래에:

```typescript
function isHeadCoach(req: Request): boolean {
  return req.user?.role === 'COACHING_STAFF' && req.user?.coachingRole === 'HEAD_COACH'
}
```

- [ ] **Step 2: `approve` 핸들러 권한 분기 수정**

기존:
```typescript
if (!isGM(req)) throw new AppError(403, "FORBIDDEN");
```

변경:
```typescript
const report = await this.service.get(id) // 이미 조회하므로 재사용 가능하면 재사용
// TRAINING 타입은 HEAD_COACH가 결재, 나머지는 GM
const canApprove =
  report.type === 'TRAINING' ? isHeadCoach(req) : isGM(req)
if (!canApprove) throw new AppError(403, 'FORBIDDEN')
```

> 컨트롤러가 service.approve를 호출하기 전에 report를 조회하지 않는다면, service.approve 내부에서 type을 확인하고 `AppError(403)` 을 던지도록 service 레이어에서 처리한다.

- [ ] **Step 3: `reject` 핸들러도 동일하게 분기**

```typescript
const canReject =
  report.type === 'TRAINING' ? isHeadCoach(req) : isGM(req)
if (!canReject) throw new AppError(403, 'FORBIDDEN')
```

- [ ] **Step 4: `list` — HEAD_COACH에게 TRAINING 보고서 노출**

`report.repo.ts`의 `findAll`:

```typescript
findAll(userId: number, isGM: boolean, isHeadCoach: boolean) {
  const where = isGM
    ? {}
    : isHeadCoach
    ? { OR: [{ authorId: userId }, { type: 'TRAINING' }] }
    : { authorId: userId }
  return this.prisma.report.findMany({
    where: where as any,
    include: reportInclude,
    orderBy: { createdAt: 'desc' },
  })
}
```

`report.service.ts`의 `list`:
```typescript
list(userId: number, isGM: boolean, isHeadCoach: boolean) {
  return this.repo.findAll(userId, isGM, isHeadCoach)
}
```

`report.controller.ts`의 list 핸들러:
```typescript
res.json(await this.service.list(req.user!.id, isGM(req), isHeadCoach(req)))
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/report/report.controller.ts \
        apps/api/src/report/report.repo.ts \
        apps/api/src/report/report.service.ts
git commit -m "feat(report): HEAD_COACH can approve/view TRAINING reports"
```

---

### Task 8: FE — `TRAINING` 타입·레이블·스타일 추가

**Files:**
- Modify: `football/src/types/report.ts`

- [ ] **Step 1: 타입 확장**

```typescript
export type ReportType = 'FINANCIAL' | 'PERFORMANCE' | 'MEDICAL' | 'TRAINING'
```

- [ ] **Step 2: 레이블 추가**

```typescript
export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  FINANCIAL: '재무',
  PERFORMANCE: '성과',
  MEDICAL: '의무보고서',
  TRAINING: '훈련',
}
```

- [ ] **Step 3: 스타일 추가**

```typescript
export const REPORT_TYPE_STYLE: Record<ReportType, string> = {
  FINANCIAL: 'border-purple-300 text-purple-700 bg-purple-50',
  PERFORMANCE: 'border-orange-300 text-orange-700 bg-orange-50',
  MEDICAL: 'border-teal-300 text-teal-700 bg-teal-50',
  TRAINING: 'border-blue-300 text-blue-700 bg-blue-50',
}
```

- [ ] **Step 4: 타입 에러 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: 수동 검증**

```
브라우저 → /reports/new
1. 유형 셀렉트에 "훈련" 항목 표시 확인
2. 훈련 보고서 작성·상신 → COACHING_STAFF HEAD_COACH 계정으로 로그인 후 승인 확인
3. GM 계정으로 훈련 보고서 승인 시도 → 403 확인
```

- [ ] **Step 6: Commit**

```bash
git add football/src/types/report.ts
git commit -m "feat(report): add TRAINING report type with label and style"
```

---

## Self-Review

### Spec 커버리지 체크

| 요구사항 | Task |
|----------|------|
| 훈련 결과 기간 필터 조회 | Task 1–2 (BE), Task 3–4 (FE) |
| sessionType 필터 | Task 1–2 (BE), Task 4 (FE) |
| CSV 내보내기 | Task 4 (`exportCsv`) |
| TRAINING 보고서 타입 | Task 6–8 |
| HEAD_COACH 결재 권한 | Task 7 |
| HEAD_COACH 보고서 목록 열람 | Task 7 (`list` 분기) |

### 주의사항

- `trainingApi.getResults`에서 `sessionType: ''`(빈 문자열)을 필터에 넘기면 BE가 sessionType 필터를 적용한다. `from` `to`와 동일하게 빈 값은 파라미터를 제외해야 함 → Task 3 Step 2의 `if (filters.sessionType)` 조건으로 처리됨.
- `prisma generate` 후 FE `@/types` 자동 생성 타입이 있다면 `TRAINING`이 자동으로 포함되는지 확인. 없으면 Task 8로 수동 추가.

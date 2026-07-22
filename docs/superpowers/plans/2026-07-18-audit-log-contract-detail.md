# AuditLog 조회 UI + Contract 상세 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADMIN이 감사 로그를 조회할 수 있는 페이지를 추가하고, Contract 상세 페이지에서 바이아웃 조항·연장 옵션·성과 보너스(BonusTrigger 포함)를 조회·등록할 수 있게 한다.

**Architecture:** AuditLog는 기존 `/admin` 모듈에 repo/service/controller/route를 추가하고, FE에 `AuditLogPage.tsx`를 신설한다. Contract 상세는 BE는 이미 완비(`GET /contracts/:id`, `POST /contracts/:id/buyout|extensions|bonuses`)되어 있으므로 FE `ContractDetailPage.tsx`를 신설하고, `ContractsPage.tsx` 행 클릭 → 상세 페이지로 네비게이션한다.

**Tech Stack:** Express + Prisma + TypeScript (BE) · React + Vite + shadcn/ui + react-router-dom (FE) · vitest (테스트)

---

## 파일 구조

**BE (AuditLog):**
- Modify: `apps/api/src/admin/admin.repo.ts` — `listAuditLogs()` 추가
- Modify: `apps/api/src/admin/admin.service.ts` — `getAuditLogs()` 추가
- Modify: `apps/api/src/admin/admin.controller.ts` — `listAuditLogs` 핸들러 추가
- Modify: `apps/api/src/admin/admin.routes.ts` — `GET /audit-logs` 등록

**FE (AuditLog):**
- Create: `football/src/services/admin.service.ts` (or modify if exists) — `auditLogApi.list()`
- Create: `football/src/types/auditLog.ts` — `AuditLogEntry` 타입
- Create: `football/src/pages/admin/AuditLogPage.tsx`
- Modify: `football/src/App.tsx` — `/admin/audit-logs` 라우트
- Modify: `football/src/layouts/AppShell.tsx` — 사이드바 링크

**FE (Contract 상세):**
- Modify: `football/src/services/contract.service.ts` — `addBuyout`, `addExtension`, `addBonus` 추가
- Modify: `football/src/types/contract.ts` — `BonusTeamScope` 타입, `CreateBonusDto` 추가
- Create: `football/src/pages/contracts/ContractDetailPage.tsx`
- Modify: `football/src/pages/contracts/ContractsPage.tsx` — 행 클릭 → navigate
- Modify: `football/src/App.tsx` — `/contracts/:id` 라우트

---

## Part A — AuditLog 조회

---

### Task 1: BE — AuditLog 목록 조회 (repo/service/controller/route)

**Files:**
- Modify: `apps/api/src/admin/admin.repo.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/api/src/admin/admin.routes.ts`

- [x] **Step 1: `admin.repo.ts`에 `listAuditLogs()` 추가**

파일을 열어 클래스 마지막에 추가:

```typescript
listAuditLogs(filters: {
  actorId?: number;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const limit = filters.limit ?? 50;
  const page = filters.page ?? 1;
  return this.prisma.auditLog.findMany({
    where: {
      ...(filters.actorId && { actorId: filters.actorId }),
      ...(filters.action && { action: filters.action }),
      ...(filters.from || filters.to ? {
        createdAt: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to && { lte: new Date(filters.to + 'T23:59:59') }),
        },
      } : {}),
    },
    select: {
      id: true,
      action: true,
      targetId: true,
      detail: true,
      createdAt: true,
      actor: { select: { id: true, username: true, nickname: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

countAuditLogs(filters: { actorId?: number; action?: string; from?: string; to?: string }) {
  return this.prisma.auditLog.count({
    where: {
      ...(filters.actorId && { actorId: filters.actorId }),
      ...(filters.action && { action: filters.action }),
      ...(filters.from || filters.to ? {
        createdAt: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to && { lte: new Date(filters.to + 'T23:59:59') }),
        },
      } : {}),
    },
  });
}
```

- [x] **Step 2: `admin.service.ts`에 `getAuditLogs()` 추가**

```typescript
async getAuditLogs(filters: {
  actorId?: number;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const [logs, total] = await Promise.all([
    this.repo.listAuditLogs(filters),
    this.repo.countAuditLogs(filters),
  ]);
  return { logs, total };
}
```

- [x] **Step 3: `admin.controller.ts`에 `listAuditLogs` 핸들러 추가**

```typescript
listAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);
    const filters = {
      ...(req.query['actorId'] && { actorId: Number(req.query['actorId']) }),
      ...(req.query['action'] && { action: req.query['action'] as string }),
      ...(req.query['from'] && { from: req.query['from'] as string }),
      ...(req.query['to'] && { to: req.query['to'] as string }),
      ...(req.query['page'] && { page: Number(req.query['page']) }),
      ...(req.query['limit'] && { limit: Number(req.query['limit']) }),
    };
    res.status(200).json(await this.service.getAuditLogs(filters));
  } catch (err) {
    next(err);
  }
};
```

- [x] **Step 4: `admin.routes.ts`에 라우트 등록**

기존 `router.get("/users", ...)` 위에 추가:

```typescript
router.get("/audit-logs", auth, controller.listAuditLogs);
```

- [x] **Step 5: 동작 확인**

```bash
cd apps/api && npx ts-node -e "
const { execSync } = require('child_process');
console.log('컴파일 확인');
" 2>&1 || npx tsc --noEmit 2>&1 | head -20
```

Expected: 타입 오류 없음

- [x] **Step 6: Commit**

```bash
git add apps/api/src/admin/
git commit -m "feat(admin): add GET /admin/audit-logs endpoint with pagination"
```

---

### Task 2: FE — AuditLog 타입 + 서비스

**Files:**
- Create: `football/src/types/auditLog.ts`
- Modify: `football/src/services/admin.service.ts`

- [x] **Step 1: `football/src/types/auditLog.ts` 생성**

```typescript
export interface AuditLogActor {
  id: number
  username: string
  nickname: string | null
  role: string
}

export interface AuditLogEntry {
  id: number
  action: string
  targetId: string | null
  detail: unknown
  createdAt: string
  actor: AuditLogActor
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[]
  total: number
}

export interface AuditLogFilters {
  actorId?: number
  action?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}
```

- [x] **Step 2: `football/src/services/admin.service.ts` 확인 및 `auditLogApi` 추가**

파일이 없으면 생성, 있으면 추가:

```typescript
import { api } from './api'
import type { AuditLogListResponse, AuditLogFilters } from '@/types/auditLog'

export const auditLogApi = {
  list: (filters: AuditLogFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.actorId) params.set('actorId', String(filters.actorId))
    if (filters.action) params.set('action', filters.action)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.page) params.set('page', String(filters.page))
    if (filters.limit) params.set('limit', String(filters.limit))
    return api.get<AuditLogListResponse>(`/admin/audit-logs?${params.toString()}`)
  },
}
```

- [x] **Step 3: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음

- [x] **Step 4: Commit**

```bash
git add football/src/types/auditLog.ts football/src/services/admin.service.ts
git commit -m "feat(admin): add AuditLog types and API service"
```

---

### Task 3: FE — AuditLogPage 구현

**Files:**
- Create: `football/src/pages/admin/AuditLogPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [x] **Step 1: `AuditLogPage.tsx` 생성**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { auditLogApi } from '@/services/admin.service'
import type { AuditLogEntry, AuditLogFilters } from '@/types/auditLog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 50

function formatDate(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    from: '', to: '', action: '', page: 1, limit: PAGE_SIZE,
  })
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchLogs = useCallback(async (f: AuditLogFilters) => {
    setLoading(true)
    try {
      const res = await auditLogApi.list(f)
      setLogs(res.logs)
      setTotal(res.total)
    } catch {
      toast.error('감사 로그를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs(filters) }, [])

  const handleSearch = () => fetchLogs({ ...filters, page: 1 })

  const handlePageChange = (page: number) => {
    const next = { ...filters, page }
    setFilters(next)
    fetchLogs(next)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">감사 로그</h1>
        <p className="text-sm text-muted-foreground mt-0.5">전체 {total}건</p>
      </div>

      <div className="border-b px-6 py-3 flex flex-wrap gap-4 items-end shrink-0 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">시작일</Label>
          <Input
            type="date"
            value={filters.from ?? ''}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">종료일</Label>
          <Input
            type="date"
            value={filters.to ?? ''}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">액션</Label>
          <Input
            placeholder="ROLE_UPDATE"
            value={filters.action ?? ''}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            className="w-40 h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={loading} className="h-8">
          {loading ? '조회 중...' : '조회'}
        </Button>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-44">일시</TableHead>
                <TableHead className="w-32">액션</TableHead>
                <TableHead>수행자</TableHead>
                <TableHead className="w-32">대상 ID</TableHead>
                <TableHead>상세</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    로그가 없습니다.
                  </TableCell>
                </TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="tabular-nums text-xs">{formatDate(log.createdAt)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono bg-muted">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.actor.nickname ?? log.actor.username}
                    <span className="ml-1 text-xs text-muted-foreground">({log.actor.role})</span>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {log.targetId ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate font-mono">
                    {log.detail ? JSON.stringify(log.detail) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Pagination
        page={filters.page ?? 1}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />
    </div>
  )
}
```

- [x] **Step 2: `App.tsx`에 라우트 추가**

기존 admin 라우트 근처에 추가:

```typescript
import { AuditLogPage } from '@/pages/admin/AuditLogPage'
// ...
<Route path="/admin/audit-logs" element={<AuditLogPage />} />
```

- [x] **Step 3: `AppShell.tsx`에 사이드바 링크 추가**

관리자 섹션에 추가 (기존 Users 링크 아래):

```typescript
{ to: '/admin/audit-logs', label: '감사 로그', icon: <ClipboardList className="h-4 w-4" /> },
```

`ClipboardList`는 lucide-react에서 import.

- [x] **Step 4: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음

- [x] **Step 5: Commit**

```bash
git add football/src/pages/admin/AuditLogPage.tsx football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(admin): add AuditLog page with date/action filter and pagination"
```

---

## Part B — Contract 상세 페이지

---

### Task 4: FE — Contract 서비스 + 타입 확장

**Files:**
- Modify: `football/src/types/contract.ts`
- Modify: `football/src/services/contract.service.ts`

- [x] **Step 1: `football/src/types/contract.ts`에 타입 추가**

파일 하단에 추가:

```typescript
export type BonusTeamScope = 'ALL' | 'FIRST_TEAM_ONLY'

export const BONUS_METRIC_LABEL: Record<BonusMetric, string> = {
  GOALS: '골',
  ASSISTS: '어시스트',
  APPEARANCES: '출전',
  CLEAN_SHEETS: '무실점',
  SAVES: '선방',
  PASS_ACCURACY: '패스 정확도(%)',
  TACKLE_SUCCESS_RATE: '태클 성공률(%)',
  CLEARANCES: '클리어',
  INTERCEPTIONS: '인터셉트',
  XG: 'xG',
  TEAM_RANK: '팀 순위',
  TEAM_WINS: '팀 승수',
}

export const BONUS_PERIOD_LABEL: Record<BonusPeriod, string> = {
  SEASON: '시즌',
  MONTH: '월',
  MATCH: '경기',
}

export interface CreateExtensionDto {
  condition: string
  durationMonths: number
}

export interface CreateBonusTriggerDto {
  metric: BonusMetric
  threshold: number
  period: BonusPeriod
  competitionType?: CompetitionType | null
  teamScope?: BonusTeamScope
}

export interface CreateBonusDto {
  amount: number
  description: string
  triggers: CreateBonusTriggerDto[]
}
```

- [x] **Step 2: `football/src/services/contract.service.ts`에 API 추가**

```typescript
addBuyout: (contractId: number, amount: number) =>
  api.post<ContractDetail>(`/contracts/${contractId}/buyout`, { amount }),

addExtension: (contractId: number, dto: CreateExtensionDto) =>
  api.post<ContractDetail>(`/contracts/${contractId}/extensions`, dto),

addBonus: (contractId: number, dto: CreateBonusDto) =>
  api.post<ContractDetail>(`/contracts/${contractId}/bonuses`, dto),
```

import 추가:
```typescript
import type { ..., CreateExtensionDto, CreateBonusDto } from '@/types/contract'
```

- [x] **Step 3: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -20
```

- [x] **Step 4: Commit**

```bash
git add football/src/types/contract.ts football/src/services/contract.service.ts
git commit -m "feat(contract): extend types and service for buyout/extension/bonus"
```

---

### Task 5: FE — ContractDetailPage 구현

**Files:**
- Create: `football/src/pages/contracts/ContractDetailPage.tsx`
- Modify: `football/src/pages/contracts/ContractsPage.tsx`
- Modify: `football/src/App.tsx`

- [x] **Step 1: `ContractDetailPage.tsx` 생성**

```typescript
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { contractApi } from '@/services/contract.service'
import type {
  ContractDetail, BonusMetric, BonusPeriod, CompetitionType,
  CreateExtensionDto, CreateBonusDto,
} from '@/types/contract'
import {
  CONTRACT_STATUS_LABEL, CONTRACT_STATUS_STYLE,
  BONUS_METRIC_LABEL, BONUS_PERIOD_LABEL, formatSalary,
} from '@/types/contract'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus } from 'lucide-react'

const BONUS_METRICS = Object.keys(BONUS_METRIC_LABEL) as BonusMetric[]
const BONUS_PERIODS = Object.keys(BONUS_PERIOD_LABEL) as BonusPeriod[]
const COMPETITION_TYPES: Array<{ value: CompetitionType | ''; label: string }> = [
  { value: '', label: '전체' },
  { value: 'LEAGUE', label: '리그' },
  { value: 'CUP', label: '컵' },
  { value: 'CHAMPIONS_LEAGUE', label: '챔피언스리그' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

interface AddExtensionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  onSaved: () => void
}

function AddExtensionDialog({ open, onOpenChange, contractId, onSaved }: AddExtensionDialogProps) {
  const [condition, setCondition] = useState('')
  const [durationMonths, setDurationMonths] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!condition.trim() || !durationMonths) {
      toast.error('모든 항목을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const dto: CreateExtensionDto = { condition: condition.trim(), durationMonths: Number(durationMonths) }
      await contractApi.addExtension(contractId, dto)
      toast.success('연장 옵션이 추가됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>연장 옵션 추가</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>조건 *</Label>
            <Input
              placeholder="챔피언스리그 진출 시 1년 연장"
              value={condition}
              onChange={e => setCondition(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>연장 기간(개월) *</Label>
            <Input
              type="number"
              min="1"
              placeholder="12"
              value={durationMonths}
              onChange={e => setDurationMonths(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '추가'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AddBonusDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  onSaved: () => void
}

function AddBonusDialog({ open, onOpenChange, contractId, onSaved }: AddBonusDialogProps) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [metric, setMetric] = useState<BonusMetric>('GOALS')
  const [threshold, setThreshold] = useState('')
  const [period, setPeriod] = useState<BonusPeriod>('SEASON')
  const [competitionType, setCompetitionType] = useState<CompetitionType | ''>('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!description.trim() || !amount || !threshold) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const dto: CreateBonusDto = {
        amount: Number(amount),
        description: description.trim(),
        triggers: [{
          metric,
          threshold: Number(threshold),
          period,
          competitionType: competitionType || null,
        }],
      }
      await contractApi.addBonus(contractId, dto)
      toast.success('성과 보너스가 추가됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>성과 보너스 추가</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>설명 *</Label>
            <Input placeholder="시즌 10골 달성 보너스" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>금액(원) *</Label>
            <Input type="number" placeholder="5000000" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>지표 *</Label>
            <Select
              value={metric}
              onValueChange={v => setMetric(v as BonusMetric)}
              items={BONUS_METRIC_LABEL}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BONUS_METRICS.map(m => (
                  <SelectItem key={m} value={m}>{BONUS_METRIC_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>임계값 *</Label>
            <Input type="number" placeholder="10" value={threshold} onChange={e => setThreshold(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>기간 *</Label>
            <Select
              value={period}
              onValueChange={v => setPeriod(v as BonusPeriod)}
              items={BONUS_PERIOD_LABEL}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BONUS_PERIODS.map(p => (
                  <SelectItem key={p} value={p}>{BONUS_PERIOD_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>대회 유형</Label>
            <Select
              value={competitionType}
              onValueChange={v => setCompetitionType(v as CompetitionType | '')}
              items={Object.fromEntries(COMPETITION_TYPES.map(c => [c.value, c.label]))}
            >
              <SelectTrigger><SelectValue placeholder="전체" /></SelectTrigger>
              <SelectContent>
                {COMPETITION_TYPES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '추가'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyoutAmount, setBuyoutAmount] = useState('')
  const [addingBuyout, setAddingBuyout] = useState(false)
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false)
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await contractApi.get(Number(id))
      setContract(data)
    } catch {
      toast.error('계약 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleAddBuyout = async () => {
    if (!buyoutAmount || !contract) return
    setAddingBuyout(true)
    try {
      await contractApi.addBuyout(contract.id, Number(buyoutAmount))
      toast.success('바이아웃 조항이 추가됐습니다.')
      setBuyoutAmount('')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setAddingBuyout(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  if (!contract) return null

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">계약 상세</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${CONTRACT_STATUS_STYLE[contract.status]}`}>
              {CONTRACT_STATUS_LABEL[contract.status]}
            </span>
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* 기본 정보 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">기본 정보</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">계약 기간</dt>
              <dd className="font-medium tabular-nums">
                {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">연봉</dt>
              <dd className="font-medium">{formatSalary(contract.salary)}</dd>
            </div>
          </dl>
        </section>

        {/* 바이아웃 조항 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">바이아웃 조항</h2>
          {contract.buyoutClause ? (
            <p className="text-sm font-medium">{formatSalary(contract.buyoutClause.amount)}</p>
          ) : canWrite ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="금액(원)"
                value={buyoutAmount}
                onChange={e => setBuyoutAmount(e.target.value)}
                className="w-40 h-8 text-sm"
              />
              <Button size="sm" className="h-8" onClick={handleAddBuyout} disabled={addingBuyout || !buyoutAmount}>
                {addingBuyout ? '저장 중...' : '추가'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">없음</p>
          )}
        </section>

        {/* 연장 옵션 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">연장 옵션</h2>
            {canWrite && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExtensionDialogOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />추가
              </Button>
            )}
          </div>
          {contract.extensionOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 연장 옵션이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {contract.extensionOptions.map(e => (
                <li key={e.id} className="rounded border px-3 py-2 text-sm">
                  <span className="font-medium">{e.durationMonths}개월</span>
                  <span className="mx-2 text-muted-foreground">—</span>
                  {e.condition}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 성과 보너스 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">성과 보너스</h2>
            {canWrite && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBonusDialogOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />추가
              </Button>
            )}
          </div>
          {contract.performanceBonuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 성과 보너스가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {contract.performanceBonuses.map(b => (
                <li key={b.id} className="rounded border px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{b.description}</span>
                    <span className="text-sm tabular-nums">{formatSalary(b.amount)}</span>
                  </div>
                  <ul className="space-y-1">
                    {b.triggers.map(t => (
                      <li key={t.id} className="text-xs text-muted-foreground">
                        {BONUS_METRIC_LABEL[t.metric]} ≥ {t.threshold} ({BONUS_PERIOD_LABEL[t.period]})
                        {t.competitionType && ` · ${t.competitionType}`}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AddExtensionDialog
        open={extensionDialogOpen}
        onOpenChange={setExtensionDialogOpen}
        contractId={contract.id}
        onSaved={() => { setExtensionDialogOpen(false); load() }}
      />
      <AddBonusDialog
        open={bonusDialogOpen}
        onOpenChange={setBonusDialogOpen}
        contractId={contract.id}
        onSaved={() => { setBonusDialogOpen(false); load() }}
      />
    </div>
  )
}
```

- [x] **Step 2: `ContractsPage.tsx`에 행 클릭 → navigate 추가**

`useNavigate` hook 추가 및 `TableRow`에 onClick 추가:

```typescript
// 상단 import에 추가
import { useNavigate } from 'react-router-dom'

// 컴포넌트 내부
const navigate = useNavigate()

// TableRow에 onClick 추가 (계약 행에)
<TableRow
  key={contract.id}
  className="cursor-pointer"
  onClick={() => navigate(`/contracts/${contract.id}`)}
>
```

- [x] **Step 3: `App.tsx`에 라우트 추가**

```typescript
import { ContractDetailPage } from '@/pages/contracts/ContractDetailPage'
// ...
<Route path="/contracts/:id" element={<ContractDetailPage />} />
```

기존 `/contracts` 라우트 바로 아래에 배치.

- [x] **Step 4: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음

- [x] **Step 5: Commit**

```bash
git add football/src/pages/contracts/ContractDetailPage.tsx \
        football/src/pages/contracts/ContractsPage.tsx \
        football/src/App.tsx
git commit -m "feat(contract): add ContractDetailPage with buyout/extension/bonus UI"
```

---

## Self-Review

**Spec coverage:**
- ✅ AuditLog 목록 BE (`GET /admin/audit-logs?actorId&action&from&to&page&limit`)
- ✅ AuditLog FE 페이지 (날짜·액션 필터, 페이지네이션)
- ✅ Contract 상세 FE (바이아웃·연장옵션·성과보너스 조회 + 추가)
- ✅ BonusTrigger metric/threshold/period/competitionType 입력
- ✅ ADMIN 권한 체크 (AuditLog)
- ✅ canWrite (ADMIN/FRONT_OFFICE) 체크 (Contract 수정 버튼)

**Placeholder 없음 확인:** 모든 스텝에 실제 코드 포함됨.

**Type consistency 확인:** `CreateExtensionDto`, `CreateBonusDto`는 Task 4에서 정의 후 Task 5에서 사용.

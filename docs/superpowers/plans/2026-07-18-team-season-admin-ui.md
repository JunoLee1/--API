# Team & Season 관리 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADMIN이 팀(Team)과 시즌(Season)을 생성·수정·관리할 수 있는 어드민 페이지를 추가한다.

**Architecture:** Season BE API는 이미 완전히 구현되어 있음(POST/GET/PATCH activate/close). Team BE API는 없으므로 BE 모듈을 먼저 추가한 후 FE 페이지를 구현한다. 두 페이지 모두 `/admin/` 경로에 위치하며 ADMIN 전용이다.

**Tech Stack:** Express + Prisma (BE), React + Vite + TypeScript + shadcn/ui (FE)

---

## 파일 구조

**BE (Team 신규)**
- `apps/api/src/team/team.repo.ts` — Prisma CRUD
- `apps/api/src/team/team.service.ts` — 비즈니스 로직
- `apps/api/src/team/team.controller.ts` — HTTP 핸들러
- `apps/api/src/team/team.routes.ts` — 라우터
- `apps/api/src/apiRouter.ts` — `/teams` 라우터 등록

**FE (신규)**
- `football/src/types/team.ts` — Team 타입
- `football/src/services/team.service.ts` — teamApi
- `football/src/pages/admin/TeamsPage.tsx` — 팀 관리 페이지
- `football/src/pages/admin/SeasonsPage.tsx` — 시즌 관리 페이지
- `football/src/services/season.service.ts` — 기존 파일에 create/activate/close 추가
- `football/src/App.tsx` — 라우트 등록
- `football/src/layouts/AppShell.tsx` — 사이드바 링크 추가

---

## Part A: Team BE API

### Task 1: Team repo + service + controller + routes

**Files:**
- Create: `apps/api/src/team/team.repo.ts`
- Create: `apps/api/src/team/team.service.ts`
- Create: `apps/api/src/team/team.controller.ts`
- Create: `apps/api/src/team/team.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: team.repo.ts 작성**

```typescript
// apps/api/src/team/team.repo.ts
import { PrismaClient } from "../generated/client";

export interface CreateTeamDto {
  name: string;
  type: "FIRST_TEAM" | "YOUTH";
  ageGroup?: string;
  trackStats?: boolean;
  requiresContract?: boolean;
}

export interface UpdateTeamDto {
  name?: string;
  ageGroup?: string;
  trackStats?: boolean;
  requiresContract?: boolean;
  isActive?: boolean;
}

export class TeamRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.team.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  }

  findById(id: number) {
    return this.prisma.team.findUnique({ where: { id } });
  }

  create(dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        type: dto.type,
        ageGroup: dto.ageGroup ?? null,
        trackStats: dto.trackStats ?? true,
        requiresContract: dto.requiresContract ?? true,
      },
    });
  }

  update(id: number, dto: UpdateTeamDto) {
    return this.prisma.team.update({ where: { id }, data: dto });
  }
}
```

- [ ] **Step 2: team.service.ts 작성**

```typescript
// apps/api/src/team/team.service.ts
import { TeamRepository, CreateTeamDto, UpdateTeamDto } from "./team.repo";
import { AppError } from "../lib/appError";

export class TeamService {
  constructor(private repo: TeamRepository) {}

  getAll() {
    return this.repo.findAll();
  }

  async getById(id: number) {
    const team = await this.repo.findById(id);
    if (!team) throw new AppError(404, "TEAM_NOT_FOUND");
    return team;
  }

  create(dto: CreateTeamDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateTeamDto) {
    await this.getById(id);
    return this.repo.update(id, dto);
  }

  async deactivate(id: number) {
    await this.getById(id);
    return this.repo.update(id, { isActive: false });
  }
}
```

- [ ] **Step 3: team.controller.ts 작성**

```typescript
// apps/api/src/team/team.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { TeamService } from "./team.service";

export class TeamController {
  constructor(private service: TeamService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getAll());
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.create(req.body));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.update(Number(req.params["id"]), req.body));
    } catch (err) { next(err); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.deactivate(Number(req.params["id"])));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 4: team.routes.ts 작성**

```typescript
// apps/api/src/team/team.routes.ts
import { Router } from "express";
import passport from "passport";
import { TeamController } from "./team.controller";
import { TeamService } from "./team.service";
import { TeamRepository } from "./team.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new TeamRepository(getPrisma());
const service = new TeamService(repo);
const controller = new TeamController(service);
const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);
router.get("/:id", auth, controller.getById);
router.post("/", auth, controller.create);
router.patch("/:id", auth, controller.update);
router.patch("/:id/deactivate", auth, controller.deactivate);

export default router;
```

- [ ] **Step 5: apiRouter.ts에 /teams 등록**

`apps/api/src/apiRouter.ts` 상단 imports에 추가:
```typescript
import teamRouter from "./team/team.routes";
```

`apiRouter.use("/coaches", coachRouter);` 줄 다음에 추가:
```typescript
apiRouter.use("/teams", teamRouter);
```

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/team/ apps/api/src/apiRouter.ts
git commit -m "feat(team): add Team CRUD BE API"
```

---

## Part B: Season FE 서비스 확장

### Task 2: Season 서비스에 create/activate/close 추가

**Files:**
- Modify: `football/src/services/season.service.ts`
- Modify: `football/src/types/season.ts`

- [ ] **Step 1: types/season.ts 확장**

현재 파일 내용을 다음으로 교체:
```typescript
// football/src/types/season.ts
export type SeasonStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED'

export interface Season {
  id: number
  name: string
  startDate: string
  endDate: string
  status: SeasonStatus
}

export const SEASON_STATUS_LABEL: Record<SeasonStatus, string> = {
  UPCOMING: '예정',
  ACTIVE: '진행 중',
  CLOSED: '종료',
}

export const SEASON_STATUS_STYLE: Record<SeasonStatus, string> = {
  UPCOMING: 'border-yellow-300 text-yellow-700 bg-yellow-50',
  ACTIVE: 'border-green-300 text-green-700 bg-green-50',
  CLOSED: 'border-gray-300 text-gray-600 bg-gray-50',
}
```

- [ ] **Step 2: services/season.service.ts 확장**

현재 파일 내용을 다음으로 교체:
```typescript
// football/src/services/season.service.ts
import { api } from './api'
import type { Season } from '@/types/season'

export const seasonApi = {
  list: (status?: string) =>
    api.get<Season[]>(`/seasons${status ? `?status=${status}` : ''}`),

  active: () => api.get<Season | null>('/seasons/active'),

  create: (payload: { name: string; startDate: string; endDate: string }) =>
    api.post<Season>('/seasons', payload),

  activate: (id: number) =>
    api.patch<Season>(`/seasons/${id}/activate`, {}),

  close: (id: number) =>
    api.patch<Season>(`/seasons/${id}/close`, {}),
}
```

- [ ] **Step 3: 커밋**

```bash
git add football/src/services/season.service.ts football/src/types/season.ts
git commit -m "feat(season): extend season service with create/activate/close"
```

---

## Part C: Team FE 타입 + 서비스

### Task 3: Team FE 타입 + API 서비스

**Files:**
- Create: `football/src/types/team.ts`
- Create: `football/src/services/team.service.ts`

- [ ] **Step 1: types/team.ts 작성**

```typescript
// football/src/types/team.ts
export type TeamType = 'FIRST_TEAM' | 'YOUTH'

export interface Team {
  id: number
  name: string
  type: TeamType
  ageGroup: string | null
  isActive: boolean
  trackStats: boolean
  requiresContract: boolean
}

export const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  FIRST_TEAM: '1군',
  YOUTH: '유소년',
}
```

- [ ] **Step 2: services/team.service.ts 작성**

```typescript
// football/src/services/team.service.ts
import { api } from './api'
import type { Team, TeamType } from '@/types/team'

export interface CreateTeamPayload {
  name: string
  type: TeamType
  ageGroup?: string
  trackStats?: boolean
  requiresContract?: boolean
}

export const teamApi = {
  list: () => api.get<Team[]>('/teams'),
  create: (payload: CreateTeamPayload) => api.post<Team>('/teams', payload),
  update: (id: number, payload: Partial<CreateTeamPayload & { isActive: boolean }>) =>
    api.patch<Team>(`/teams/${id}`, payload),
  deactivate: (id: number) => api.patch<Team>(`/teams/${id}/deactivate`, {}),
}
```

- [ ] **Step 3: 커밋**

```bash
git add football/src/types/team.ts football/src/services/team.service.ts
git commit -m "feat(team): add Team FE types and API service"
```

---

## Part D: SeasonsPage

### Task 4: SeasonsPage 구현

**Files:**
- Create: `football/src/pages/admin/SeasonsPage.tsx`

- [ ] **Step 1: SeasonsPage.tsx 작성**

```tsx
// football/src/pages/admin/SeasonsPage.tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { seasonApi } from '@/services/season.service'
import type { Season, SeasonStatus } from '@/types/season'
import { SEASON_STATUS_LABEL, SEASON_STATUS_STYLE } from '@/types/season'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

interface CreateSeasonDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateSeasonDialog({ open, onOpenChange, onSaved }: CreateSeasonDialogProps) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error('모든 항목을 입력해주세요.')
      return
    }
    if (endDate <= startDate) {
      toast.error('종료일은 시작일 이후여야 합니다.')
      return
    }
    setSaving(true)
    try {
      await seasonApi.create({ name: name.trim(), startDate, endDate })
      toast.success('시즌이 등록됐습니다.')
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
        <DialogHeader><DialogTitle>시즌 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>시즌명 *</Label>
            <Input placeholder="예: 2026-27 시즌" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>시작일 *</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>종료일 *</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SeasonsPage() {
  const { user } = useCurrentUser()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'ADMIN'

  const fetch = () => {
    setLoading(true)
    setPage(1)
    seasonApi.list()
      .then(setSeasons)
      .catch(() => toast.error('시즌 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [])

  const handleActivate = async (id: number) => {
    try {
      await seasonApi.activate(id)
      toast.success('시즌이 활성화됐습니다.')
      fetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '활성화에 실패했습니다.')
    }
  }

  const handleClose = async (id: number) => {
    try {
      await seasonApi.close(id)
      toast.success('시즌이 종료됐습니다.')
      fetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '종료에 실패했습니다.')
    }
  }

  const totalPages = Math.ceil(seasons.length / PAGE_SIZE)
  const paged = seasons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">시즌 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {seasons.length}개 시즌</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />시즌 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">로딩 중...</div>
        ) : seasons.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">등록된 시즌이 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>시즌명</TableHead>
                <TableHead className="w-28">시작일</TableHead>
                <TableHead className="w-28">종료일</TableHead>
                <TableHead className="w-24">상태</TableHead>
                {isAdmin && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(s.startDate)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(s.endDate)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${SEASON_STATUS_STYLE[s.status as SeasonStatus]}`}>
                      {SEASON_STATUS_LABEL[s.status as SeasonStatus]}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      {s.status === 'UPCOMING' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleActivate(s.id)}>활성화</Button>
                      )}
                      {s.status === 'ACTIVE' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive"
                          onClick={() => handleClose(s.id)}>종료</Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} totalItems={seasons.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <CreateSeasonDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={() => { setCreateOpen(false); fetch() }} />
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add football/src/pages/admin/SeasonsPage.tsx
git commit -m "feat(season): add SeasonsPage with create/activate/close"
```

---

## Part E: TeamsPage

### Task 5: TeamsPage 구현

**Files:**
- Create: `football/src/pages/admin/TeamsPage.tsx`

- [ ] **Step 1: TeamsPage.tsx 작성**

```tsx
// football/src/pages/admin/TeamsPage.tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { teamApi, type CreateTeamPayload } from '@/services/team.service'
import type { Team, TeamType } from '@/types/team'
import { TEAM_TYPE_LABEL } from '@/types/team'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 10
const TEAM_TYPES: TeamType[] = ['FIRST_TEAM', 'YOUTH']

interface TeamFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: Team
  onSaved: () => void
}

function TeamFormDialog({ open, onOpenChange, initial, onSaved }: TeamFormProps) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<TeamType>(initial?.type ?? 'FIRST_TEAM')
  const [ageGroup, setAgeGroup] = useState(initial?.ageGroup ?? '')
  const [trackStats, setTrackStats] = useState(initial?.trackStats ?? true)
  const [requiresContract, setRequiresContract] = useState(initial?.requiresContract ?? true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setName(initial.name); setType(initial.type); setAgeGroup(initial.ageGroup ?? '')
      setTrackStats(initial.trackStats); setRequiresContract(initial.requiresContract)
    }
  }, [initial])

  const handleSave = async () => {
    if (!name.trim()) { toast.error('팀명을 입력해주세요.'); return }
    setSaving(true)
    const payload: CreateTeamPayload = {
      name: name.trim(), type,
      ...(ageGroup.trim() && { ageGroup: ageGroup.trim() }),
      trackStats, requiresContract,
    }
    try {
      if (isEdit) {
        await teamApi.update(initial!.id, payload)
        toast.success('팀 정보가 수정됐습니다.')
      } else {
        await teamApi.create(payload)
        toast.success('팀이 등록됐습니다.')
      }
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
        <DialogHeader><DialogTitle>{isEdit ? '팀 수정' : '팀 등록'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>팀명 *</Label>
            <Input placeholder="예: 1군 A팀" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>유형 *</Label>
            <Select value={type} onValueChange={v => setType(v as TeamType)}
              items={TEAM_TYPE_LABEL}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEAM_TYPES.map(t => <SelectItem key={t} value={t}>{TEAM_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {type === 'YOUTH' && (
            <div className="space-y-1.5">
              <Label>연령 그룹</Label>
              <Input placeholder="예: U18, U15" value={ageGroup} onChange={e => setAgeGroup(e.target.value)} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="track-stats">스탯 추적</Label>
            <Switch id="track-stats" checked={trackStats} onCheckedChange={setTrackStats} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="req-contract">계약 필수</Label>
            <Switch id="req-contract" checked={requiresContract} onCheckedChange={setRequiresContract} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : isEdit ? '수정' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsPage() {
  const { user } = useCurrentUser()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Team | null>(null)
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'ADMIN'

  const fetch = () => {
    setLoading(true)
    setPage(1)
    teamApi.list()
      .then(setTeams)
      .catch(() => toast.error('팀 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [])

  const handleDeactivate = async (id: number) => {
    try {
      await teamApi.deactivate(id)
      toast.success('팀이 비활성화됐습니다.')
      fetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '비활성화에 실패했습니다.')
    }
  }

  const totalPages = Math.ceil(teams.length / PAGE_SIZE)
  const paged = teams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">팀 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {teams.length}개 팀</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />팀 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">로딩 중...</div>
        ) : teams.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">등록된 팀이 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>팀명</TableHead>
                <TableHead className="w-20">유형</TableHead>
                <TableHead className="w-20">연령그룹</TableHead>
                <TableHead className="w-20 text-center">스탯추적</TableHead>
                <TableHead className="w-20 text-center">계약필수</TableHead>
                <TableHead className="w-20 text-center">상태</TableHead>
                {isAdmin && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{TEAM_TYPE_LABEL[t.type]}</TableCell>
                  <TableCell>{t.ageGroup ?? '—'}</TableCell>
                  <TableCell className="text-center">{t.trackStats ? '✓' : '—'}</TableCell>
                  <TableCell className="text-center">{t.requiresContract ? '✓' : '—'}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${t.isActive ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
                      {t.isActive ? '활성' : '비활성'}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => setEditTarget(t)}>수정</Button>
                      {t.isActive && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive"
                          onClick={() => handleDeactivate(t.id)}>비활성화</Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} totalItems={teams.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <TeamFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={() => { setCreateOpen(false); fetch() }} />
      <TeamFormDialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)} initial={editTarget ?? undefined} onSaved={() => { setEditTarget(null); fetch() }} />
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add football/src/pages/admin/TeamsPage.tsx
git commit -m "feat(team): add TeamsPage with create/edit/deactivate"
```

---

## Part F: 라우트 + 사이드바 등록

### Task 6: App.tsx + AppShell.tsx 업데이트

**Files:**
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [ ] **Step 1: App.tsx에 라우트 추가**

`football/src/App.tsx`에서 `UsersPage` import 근처에 추가:
```typescript
import { TeamsPage } from '@/pages/admin/TeamsPage'
import { SeasonsPage } from '@/pages/admin/SeasonsPage'
```

`<Route path="/admin/users" .../>` 아래에 추가:
```tsx
<Route path="/admin/teams" element={<TeamsPage />} />
<Route path="/admin/seasons" element={<SeasonsPage />} />
```

- [ ] **Step 2: AppShell.tsx에 사이드바 링크 추가**

`football/src/layouts/AppShell.tsx` — `Users` 아이콘 import 있는 줄 근처에서 `CalendarDays` 아이콘 추가:
이미 있다면 그대로, 없으면 import에 추가: `CalendarDays, Users2`

`NAV_ITEMS` 배열에서 `to: '/admin/users'` 항목 다음에 추가:
```typescript
{
  to: '/admin/teams',
  label: '팀 관리',
  icon: Users2,
  section: '관리',
  roles: ['ADMIN'],
},
{
  to: '/admin/seasons',
  label: '시즌 관리',
  icon: CalendarDays,
  section: '관리',
  roles: ['ADMIN'],
},
```

- [ ] **Step 3: 타입스크립트 체크**

```bash
cd football && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(admin): register Team and Season management routes and sidebar links"
```

---

## 완료 기준

- `/admin/teams` — 팀 목록/생성/수정/비활성화 (ADMIN 전용)
- `/admin/seasons` — 시즌 목록/생성/활성화/종료 (ADMIN 전용), 동시 ACTIVE 1개 규칙은 BE가 보장
- 사이드바 `관리` 섹션에 "팀 관리", "시즌 관리" 링크 표시 (ADMIN만 표시)
- 페이지네이션 10건/페이지 적용

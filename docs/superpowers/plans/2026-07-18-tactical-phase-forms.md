# Tactical Phase Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전술 분석 등록/수정 폼을 PRE_MATCH(상대팀 분석)와 POST_MATCH(우리 팀 리뷰) 두 시점으로 분기하고, 행 클릭으로 상세 수정 다이얼로그를 열 수 있게 한다.

**Architecture:** Prisma 스키마에 phase-specific nullable 컬럼 10개를 추가(maomPlayerId/improvementPlayerId → Player FK 포함). BE에 `PATCH /:id` 엔드포인트를 추가. FE는 `AnalysisFormDialog` 컴포넌트 하나로 create/edit 양 모드를 처리하며, phase 선택에 따라 섹션이 동적으로 전환된다.

**Tech Stack:** Prisma ORM, PostgreSQL, Express, TypeScript, React + Vite, shadcn/ui

---

## 파일 구조

**수정:**
- `apps/api/prisma/schema.prisma` — TacticalAnalysis 신규 필드 + Player back-relations
- `apps/api/src/tactical/dto/tactical.dto.ts` — CreateAnalysisDto 확장 + UpdateAnalysisDto 신규
- `apps/api/src/tactical/tactical.repo.ts` — create() 신규 필드 포함, update() 추가, findAll() select 확장
- `apps/api/src/tactical/tactical.service.ts` — updateAnalysis() 추가
- `apps/api/src/tactical/tactical.controller.ts` — update 핸들러 추가
- `apps/api/src/tactical/tactical.routes.ts` — `PATCH /:id` 추가
- `apps/api/__test__/tactical/tactical.controller.test.ts` — update 엔드포인트 단위 테스트 추가
- `football/src/types/tactical.ts` — TacticalAnalysis 확장 + UpdateTacticalDto
- `football/src/services/tactical.service.ts` — update() 추가
- `football/src/pages/tactical/TacticalAnalysisPage.tsx` — AnalysisFormDialog(create+edit) 구현

**신규 생성:**
- `apps/api/prisma/migrations/20260718_tactical_phase_fields/migration.sql`

---

## Task 1: 스키마 — 신규 필드 추가 + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: TacticalAnalysis 모델에 PRE/POST 전용 필드 추가**

`apps/api/prisma/schema.prisma`의 `TacticalAnalysis` 모델에서 `media TacticalMedia[]` 줄 **바로 앞**에 추가:

```prisma
  // PRE_MATCH
  opponentFormation   String?
  opponentKeyThreat   String?          @db.Text
  opponentWeakness    String?          @db.Text
  opponentKeyPlayer   String?
  // POST_MATCH
  tacticalCompliance  String?          @db.Text
  concededAnalysis    String?          @db.Text
  momPlayerId         String?
  momNote             String?
  improvementPlayerId String?
  improvementNote     String?
```

같은 모델의 relation 목록 (`media TacticalMedia[]` **아래**) 에 추가:

```prisma
  momPlayer           Player?          @relation("MomPlayer", fields: [momPlayerId], references: [id])
  improvementPlayer   Player?          @relation("ImprovementPlayer", fields: [improvementPlayerId], references: [id])
```

- [x] **Step 2: Player 모델에 back-relations 추가**

`Player` 모델의 relation 목록 마지막(기존 `developmentPlans PlayerDevelopmentPlan[]` 아래)에 추가:

```prisma
  momAnalyses         TacticalAnalysis[] @relation("MomPlayer")
  improvementAnalyses TacticalAnalysis[] @relation("ImprovementPlayer")
```

- [x] **Step 3: Prisma format 확인**

```bash
cd apps/api && npx prisma format
```

Expected: 에러 없이 포맷 완료

- [x] **Step 4: Migration 생성**

```bash
cd apps/api
mkdir -p prisma/migrations/20260718_tactical_phase_fields
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/20260718_tactical_phase_fields/migration.sql
```

Expected: migration.sql 내용에 `ALTER TABLE "TacticalAnalysis" ADD COLUMN "opponentFormation"` 등 포함 확인

- [x] **Step 5: DB 적용 + 이력 등록**

```bash
cd apps/api
npx prisma db execute --file prisma/migrations/20260718_tactical_phase_fields/migration.sql
npx prisma migrate resolve --applied 20260718_tactical_phase_fields
npx prisma generate
```

Expected: 각각 에러 없이 완료, `✔ Generated Prisma Client` 출력

- [x] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260718_tactical_phase_fields/
git commit -m "feat(schema): add PRE/POST match tactical analysis phase fields"
```

---

## Task 2: BE — DTO + Repository + Service + Controller + Route

**Files:**
- Modify: `apps/api/src/tactical/dto/tactical.dto.ts`
- Modify: `apps/api/src/tactical/tactical.repo.ts`
- Modify: `apps/api/src/tactical/tactical.service.ts`
- Modify: `apps/api/src/tactical/tactical.controller.ts`
- Modify: `apps/api/src/tactical/tactical.routes.ts`

- [x] **Step 1: tactical.dto.ts — CreateAnalysisDto 확장 + UpdateAnalysisDto 신규**

`apps/api/src/tactical/dto/tactical.dto.ts` 전체 교체:

```typescript
import { TacticalPhase, Position } from "../../generated/enums";

export interface CreateAnalysisDto {
  matchId: number;
  seasonId: number;
  phase: TacticalPhase;
  formation?: string;
  opponentAnalysis?: string;
  // PRE_MATCH
  opponentFormation?: string;
  opponentKeyThreat?: string;
  opponentWeakness?: string;
  opponentKeyPlayer?: string;
  // POST_MATCH
  tacticalCompliance?: string;
  concededAnalysis?: string;
  momPlayerId?: string;
  momNote?: string;
  improvementPlayerId?: string;
  improvementNote?: string;
}

export interface UpdateAnalysisDto {
  formation?: string;
  opponentAnalysis?: string;
  opponentFormation?: string;
  opponentKeyThreat?: string;
  opponentWeakness?: string;
  opponentKeyPlayer?: string;
  tacticalCompliance?: string;
  concededAnalysis?: string;
  momPlayerId?: string;
  momNote?: string;
  improvementPlayerId?: string;
  improvementNote?: string;
}

export interface AddLineupDto {
  playerId: string;
  position: Position;
}

export interface AddMediaDto {
  url: string;
  type: string;
}
```

- [x] **Step 2: tactical.repo.ts — create() 신규 필드 포함, update() 추가, findAll() select 확장**

`apps/api/src/tactical/tactical.repo.ts` 전체 교체:

```typescript
import { PrismaClient } from "../generated/client";
import { CreateAnalysisDto, UpdateAnalysisDto, AddLineupDto, AddMediaDto } from "./dto/tactical.dto";

const n = <T>(v: T | undefined): T | null => v ?? null;
// undefined → 수정 안 함, 빈 문자열 → null, 값 → 그대로
const sn = (v?: string): string | null | undefined =>
  v === undefined ? undefined : (v.trim() === "" ? null : v.trim());

const ANALYSIS_SELECT = {
  id: true,
  matchId: true,
  phase: true,
  status: true,
  formation: true,
  opponentAnalysis: true,
  createdById: true,
  createdAt: true,
  opponentFormation: true,
  opponentKeyThreat: true,
  opponentWeakness: true,
  opponentKeyPlayer: true,
  tacticalCompliance: true,
  concededAnalysis: true,
  momPlayerId: true,
  momNote: true,
  improvementPlayerId: true,
  improvementNote: true,
  match: {
    select: {
      homeTeamName: true,
      awayTeamName: true,
      date: true,
      homeScore: true,
      awayScore: true,
    },
  },
  createdBy: { select: { nickname: true } },
  momPlayer: { select: { playerName: true } },
  improvementPlayer: { select: { playerName: true } },
} as const;

export class TacticalRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(filters?: { matchId?: number; phase?: string }) {
    return this.prisma.tacticalAnalysis.findMany({
      where: {
        ...(filters?.matchId && { matchId: filters.matchId }),
        ...(filters?.phase && { phase: filters.phase as "PRE_MATCH" | "POST_MATCH" }),
      },
      select: ANALYSIS_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findByMatch(matchId: number) {
    return this.prisma.tacticalAnalysis.findMany({
      where: { matchId },
      select: { id: true, phase: true, formation: true, createdAt: true, createdById: true },
    });
  }

  findById(id: number) {
    return this.prisma.tacticalAnalysis.findUnique({
      where: { id },
      include: {
        lineup: { include: { player: { select: { playerName: true } } } },
        media: true,
        momPlayer: { select: { playerName: true } },
        improvementPlayer: { select: { playerName: true } },
      },
    });
  }

  create(dto: CreateAnalysisDto, createdById: number) {
    return this.prisma.tacticalAnalysis.create({
      data: {
        matchId: dto.matchId,
        seasonId: dto.seasonId,
        phase: dto.phase,
        formation: n(dto.formation),
        opponentAnalysis: n(dto.opponentAnalysis),
        opponentFormation: n(dto.opponentFormation),
        opponentKeyThreat: n(dto.opponentKeyThreat),
        opponentWeakness: n(dto.opponentWeakness),
        opponentKeyPlayer: n(dto.opponentKeyPlayer),
        tacticalCompliance: n(dto.tacticalCompliance),
        concededAnalysis: n(dto.concededAnalysis),
        momPlayerId: n(dto.momPlayerId),
        momNote: n(dto.momNote),
        improvementPlayerId: n(dto.improvementPlayerId),
        improvementNote: n(dto.improvementNote),
        createdById,
      },
      select: { id: true, phase: true, formation: true, opponentAnalysis: true, createdAt: true },
    });
  }

  update(id: number, dto: UpdateAnalysisDto) {
    return this.prisma.tacticalAnalysis.update({
      where: { id },
      data: {
        formation: sn(dto.formation),
        opponentAnalysis: sn(dto.opponentAnalysis),
        opponentFormation: sn(dto.opponentFormation),
        opponentKeyThreat: sn(dto.opponentKeyThreat),
        opponentWeakness: sn(dto.opponentWeakness),
        opponentKeyPlayer: sn(dto.opponentKeyPlayer),
        tacticalCompliance: sn(dto.tacticalCompliance),
        concededAnalysis: sn(dto.concededAnalysis),
        momPlayerId: dto.momPlayerId !== undefined ? (dto.momPlayerId || null) : undefined,
        momNote: sn(dto.momNote),
        improvementPlayerId: dto.improvementPlayerId !== undefined ? (dto.improvementPlayerId || null) : undefined,
        improvementNote: sn(dto.improvementNote),
      },
      select: ANALYSIS_SELECT,
    });
  }

  addLineup(tacticalAnalysisId: number, dto: AddLineupDto) {
    return this.prisma.tacticalLineup.create({
      data: { tacticalAnalysisId, playerId: dto.playerId, position: dto.position },
    });
  }

  addMedia(tacticalAnalysisId: number, dto: AddMediaDto) {
    return this.prisma.tacticalMedia.create({
      data: { tacticalAnalysisId, url: dto.url, type: dto.type },
    });
  }

  confirm(id: number) {
    return this.prisma.tacticalAnalysis.update({
      where: { id },
      data: { status: "CONFIRMED" },
      select: { id: true, status: true },
    });
  }
}
```

- [x] **Step 3: tactical.service.ts — updateAnalysis() 추가**

`updateAnalysis` 메서드를 `confirmAnalysis` 앞에 추가:

```typescript
async updateAnalysis(id: number, dto: UpdateAnalysisDto) {
  const analysis = await this.repo.findById(id);
  if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND");
  return this.repo.update(id, dto);
}
```

`tactical.service.ts` import에 `UpdateAnalysisDto` 추가:

```typescript
import { TacticalRepository } from "./tactical.repo";
import { AppError } from "../lib/appError";
import { CreateAnalysisDto, UpdateAnalysisDto, AddLineupDto, AddMediaDto } from "./dto/tactical.dto";
import { getPrisma } from "../lib/prisma";
```

- [x] **Step 4: tactical.controller.ts — update 핸들러 추가**

`confirm` 핸들러 바로 앞에 추가:

```typescript
update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, frontOfficeRole } = req.user!;
    const canUpdate =
      role === "ADMIN" ||
      role === "COACHING_STAFF" ||
      (role === "FRONT_OFFICE" && frontOfficeRole === "TACTICAL_ANALYST");
    if (!canUpdate) throw new AppError(403, "FORBIDDEN");
    res.status(200).json(
      await this.service.updateAnalysis(Number(req.params["id"]), req.body)
    );
  } catch (err) { next(err); }
};
```

- [x] **Step 5: tactical.routes.ts — PATCH /:id 추가**

기존 `router.patch("/:id/confirm", ...)` 바로 위에 추가:

```typescript
// 전술 분석 수정 (ADMIN, COACHING_STAFF, TACTICAL_ANALYST)
router.patch("/:id", auth, controller.update);
```

- [x] **Step 6: TypeScript 컴파일 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | grep -E "tactical|error TS"
```

Expected: 출력 없음 (에러 없음)

- [x] **Step 7: Commit**

```bash
git add apps/api/src/tactical/
git commit -m "feat(tactical): add update endpoint with PRE/POST phase-specific fields"
```

---

## Task 3: BE 테스트 — update 엔드포인트 단위 테스트

**Files:**
- Modify: `apps/api/__test__/tactical/tactical.controller.test.ts`

- [x] **Step 1: mockService에 updateAnalysis + list 메서드 추가 및 update 테스트 작성**

기존 파일의 `mockService` 객체에 `updateAnalysis` 추가 후 describe 블록 추가:

```typescript
// mockService 객체에 추가
updateAnalysis: jest.fn<() => Promise<{ id: number }>>().mockResolvedValue({ id: 1 }),
list: jest.fn<() => Promise<[]>>().mockResolvedValue([]),
```

파일 맨 아래에 describe 블록 추가:

```typescript
describe("TacticalController - update", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ADMIN can update TacticalAnalysis → 200", async () => {
    const req = mockReq({
      params: { id: "1" },
      body: { formation: "4-3-3", opponentKeyThreat: "High press" },
    });
    const res = mockRes();
    await controller.update(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockService.updateAnalysis).toHaveBeenCalledWith(1, {
      formation: "4-3-3",
      opponentKeyThreat: "High press",
    });
  });

  test("PLAYER cannot update TacticalAnalysis → 403 via next", async () => {
    const req = mockReq({
      user: { id: 5, role: "PLAYER", coachingRole: null, frontOfficeRole: null },
      params: { id: "1" },
      body: {},
    });
    const res = mockRes();
    await controller.update(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("TACTICAL_ANALYST can update TacticalAnalysis → 200", async () => {
    const req = mockReq({
      user: { id: 6, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TACTICAL_ANALYST" },
      params: { id: "2" },
      body: { concededAnalysis: "압박 부족" },
    });
    const res = mockRes();
    await controller.update(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
```

- [x] **Step 2: 테스트 실행**

```bash
cd apps/api && npx jest __test__/tactical/tactical.controller.test.ts --verbose
```

Expected: 전체 테스트 PASS (기존 + 신규 3개)

- [x] **Step 3: Commit**

```bash
git add apps/api/__test__/tactical/tactical.controller.test.ts
git commit -m "test(tactical): add update endpoint unit tests"
```

---

## Task 4: FE — types + service 업데이트

**Files:**
- Modify: `football/src/types/tactical.ts`
- Modify: `football/src/services/tactical.service.ts`

- [x] **Step 1: types/tactical.ts — TacticalAnalysis 확장 + UpdateTacticalDto**

`football/src/types/tactical.ts` 전체 교체:

```typescript
export type TacticalPhase = 'PRE_MATCH' | 'POST_MATCH'
export type TacticalStatus = 'DRAFT' | 'CONFIRMED'
export type TacticalMediaType = 'image' | 'video'

export interface TacticalMedia {
  id: number
  url: string
  type: TacticalMediaType
  tacticalAnalysisId: number
}

export interface TacticalAnalysis {
  id: number
  matchId: number
  phase: TacticalPhase
  status: TacticalStatus
  formation: string | null
  opponentAnalysis: string | null
  createdById: number
  createdAt: string
  // PRE_MATCH
  opponentFormation: string | null
  opponentKeyThreat: string | null
  opponentWeakness: string | null
  opponentKeyPlayer: string | null
  // POST_MATCH
  tacticalCompliance: string | null
  concededAnalysis: string | null
  momPlayerId: string | null
  momNote: string | null
  improvementPlayerId: string | null
  improvementNote: string | null
  match: {
    homeTeamName: string
    awayTeamName: string
    date: string
    homeScore: number | null
    awayScore: number | null
  }
  createdBy: { nickname: string }
  momPlayer: { playerName: string } | null
  improvementPlayer: { playerName: string } | null
  media?: TacticalMedia[]
}

export interface CreateTacticalDto {
  matchId: number
  phase: TacticalPhase
  formation?: string
  opponentAnalysis?: string
  opponentFormation?: string
  opponentKeyThreat?: string
  opponentWeakness?: string
  opponentKeyPlayer?: string
  tacticalCompliance?: string
  concededAnalysis?: string
  momPlayerId?: string
  momNote?: string
  improvementPlayerId?: string
  improvementNote?: string
}

export interface UpdateTacticalDto {
  formation?: string
  opponentAnalysis?: string
  opponentFormation?: string
  opponentKeyThreat?: string
  opponentWeakness?: string
  opponentKeyPlayer?: string
  tacticalCompliance?: string
  concededAnalysis?: string
  momPlayerId?: string
  momNote?: string
  improvementPlayerId?: string
  improvementNote?: string
}

export const FORMATION_OPTIONS = [
  '4-3-3',
  '4-4-2',
  '4-2-3-1',
  '4-1-4-1',
  '4-5-1',
  '3-5-2',
  '3-4-3',
  '3-4-2-1',
  '5-3-2',
  '5-4-1',
  '4-3-2-1',
] as const

export const PHASE_LABEL: Record<TacticalPhase, string> = {
  PRE_MATCH: '경기 전',
  POST_MATCH: '경기 후',
}

export const PHASE_STYLE: Record<TacticalPhase, string> = {
  PRE_MATCH: 'bg-blue-100 text-blue-800 border-blue-200',
  POST_MATCH: 'bg-purple-100 text-purple-800 border-purple-200',
}

export const STATUS_LABEL: Record<TacticalStatus, string> = {
  DRAFT: '초안',
  CONFIRMED: '확정',
}

export const STATUS_STYLE: Record<TacticalStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-green-100 text-green-800 border-green-200',
}

export const MEDIA_TYPE_LABEL: Record<TacticalMediaType, string> = {
  image: '사진',
  video: '영상',
}
```

- [x] **Step 2: services/tactical.service.ts — update() 추가**

`football/src/services/tactical.service.ts` 전체 교체:

```typescript
import { api } from './api'
import type {
  TacticalAnalysis,
  TacticalMedia,
  CreateTacticalDto,
  UpdateTacticalDto,
  TacticalPhase,
} from '@/types/tactical'

export const tacticalApi = {
  list: (params?: { matchId?: number; phase?: TacticalPhase }) => {
    const qs = new URLSearchParams()
    if (params?.matchId) qs.set('matchId', String(params.matchId))
    if (params?.phase) qs.set('phase', params.phase)
    const q = qs.toString()
    return api.get<TacticalAnalysis[]>(`/tactical${q ? `?${q}` : ''}`)
  },

  get: (id: number) => api.get<TacticalAnalysis>(`/tactical/${id}`),

  create: (dto: CreateTacticalDto) =>
    api.post<TacticalAnalysis>('/tactical', dto),

  update: (id: number, dto: UpdateTacticalDto) =>
    api.patch<TacticalAnalysis>(`/tactical/${id}`, dto),

  confirm: (id: number) =>
    api.patch<TacticalAnalysis>(`/tactical/${id}/confirm`, {}),

  addMedia: (id: number, files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return api.postForm<TacticalMedia[]>(`/tactical/${id}/media`, form)
  },
}
```

- [x] **Step 3: TypeScript 컴파일 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: 출력 없음

- [x] **Step 4: Commit**

```bash
git add football/src/types/tactical.ts football/src/services/tactical.service.ts
git commit -m "feat(tactical): add UpdateTacticalDto, phase-specific fields to types and service"
```

---

## Task 5: FE — TacticalAnalysisPage (AnalysisFormDialog + 행 클릭)

**Files:**
- Modify: `football/src/pages/tactical/TacticalAnalysisPage.tsx`

- [x] **Step 1: TacticalAnalysisPage.tsx 전체 교체**

아래 코드로 전체 교체:

```tsx
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { tacticalApi } from '@/services/tactical.service'
import { matchApi } from '@/services/match.service'
import { playerApi } from '@/services/player.service'
import type {
  TacticalAnalysis,
  TacticalPhase,
  CreateTacticalDto,
  UpdateTacticalDto,
} from '@/types/tactical'
import {
  FORMATION_OPTIONS,
  PHASE_LABEL,
  PHASE_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
} from '@/types/tactical'
import type { Match } from '@/types/match'
import type { Player } from '@/types/player'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Check, ImagePlus, Plus, X } from 'lucide-react'

const PHASES: TacticalPhase[] = ['PRE_MATCH', 'POST_MATCH']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function matchLabel(m: Match) {
  return `${formatDate(m.date)} ${m.homeTeamName} vs ${m.awayTeamName}`
}

// ─── FormationSelect (재사용) ──────────────────────────────────────────────────

function FormationSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="선택">{value || undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FORMATION_OPTIONS.map((f) => (
            <SelectItem key={f} value={f}>{f}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── PlayerSelect (MOM / 보완 필요) ───────────────────────────────────────────

function PlayerSelectRow({
  label,
  players,
  playerId,
  note,
  onPlayerChange,
  onNoteChange,
}: {
  label: string
  players: Player[]
  playerId: string
  note: string
  onPlayerChange: (v: string) => void
  onNoteChange: (v: string) => void
}) {
  const selected = players.find((p) => p.id === playerId)
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={playerId} onValueChange={onPlayerChange}>
        <SelectTrigger>
          <SelectValue placeholder="선수 선택">
            {selected?.playerName ?? undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {players.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="코멘트 (선택)"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
      />
    </div>
  )
}

// ─── AnalysisFormDialog (create + edit 통합) ──────────────────────────────────

type FormMode = 'create' | 'edit'

interface AnalysisFormDialogProps {
  mode: FormMode
  open: boolean
  onOpenChange: (v: boolean) => void
  matches: Match[]
  players: Player[]
  initial?: TacticalAnalysis
  onSaved: () => void
}

function AnalysisFormDialog({
  mode,
  open,
  onOpenChange,
  matches,
  players,
  initial,
  onSaved,
}: AnalysisFormDialogProps) {
  // ── common ──
  const [matchId, setMatchId] = useState(initial ? String(initial.matchId) : '')
  const [phase, setPhase] = useState<TacticalPhase>(initial?.phase ?? 'PRE_MATCH')
  const [opponentAnalysis, setOpponentAnalysis] = useState(initial?.opponentAnalysis ?? '')
  // ── PRE_MATCH ──
  const [formation, setFormation] = useState(initial?.formation ?? '')
  const [opponentFormation, setOpponentFormation] = useState(initial?.opponentFormation ?? '')
  const [opponentKeyThreat, setOpponentKeyThreat] = useState(initial?.opponentKeyThreat ?? '')
  const [opponentWeakness, setOpponentWeakness] = useState(initial?.opponentWeakness ?? '')
  const [opponentKeyPlayer, setOpponentKeyPlayer] = useState(initial?.opponentKeyPlayer ?? '')
  // ── POST_MATCH ──
  const [tacticalCompliance, setTacticalCompliance] = useState(initial?.tacticalCompliance ?? '')
  const [concededAnalysis, setConcededAnalysis] = useState(initial?.concededAnalysis ?? '')
  const [momPlayerId, setMomPlayerId] = useState(initial?.momPlayerId ?? '')
  const [momNote, setMomNote] = useState(initial?.momNote ?? '')
  const [improvementPlayerId, setImprovementPlayerId] = useState(initial?.improvementPlayerId ?? '')
  const [improvementNote, setImprovementNote] = useState(initial?.improvementNote ?? '')
  // ── files (create 모드) ──
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setMatchId('')
    setPhase('PRE_MATCH')
    setFormation('')
    setOpponentFormation('')
    setOpponentKeyThreat('')
    setOpponentWeakness('')
    setOpponentKeyPlayer('')
    setOpponentAnalysis('')
    setTacticalCompliance('')
    setConcededAnalysis('')
    setMomPlayerId('')
    setMomNote('')
    setImprovementPlayerId('')
    setImprovementNote('')
    setFiles([])
    setPreviews([])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    setFiles((prev) => [...prev, ...selected])
    selected.forEach((f) => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (ev) => setPreviews((prev) => [...prev, ev.target!.result as string])
        reader.readAsDataURL(f)
      } else {
        setPreviews((prev) => [...prev, ''])
      }
    })
    e.target.value = ''
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const buildPreDto = (): Omit<CreateTacticalDto, 'matchId' | 'phase'> => ({
    formation: formation || undefined,
    opponentFormation: opponentFormation || undefined,
    opponentKeyThreat: opponentKeyThreat || undefined,
    opponentWeakness: opponentWeakness || undefined,
    opponentKeyPlayer: opponentKeyPlayer || undefined,
    opponentAnalysis: opponentAnalysis || undefined,
  })

  const buildPostDto = (): Omit<CreateTacticalDto, 'matchId' | 'phase'> => ({
    formation: formation || undefined,
    tacticalCompliance: tacticalCompliance || undefined,
    concededAnalysis: concededAnalysis || undefined,
    momPlayerId: momPlayerId || undefined,
    momNote: momNote || undefined,
    improvementPlayerId: improvementPlayerId || undefined,
    improvementNote: improvementNote || undefined,
    opponentAnalysis: opponentAnalysis || undefined,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      if (mode === 'create') {
        if (!matchId) { toast.error('경기를 선택해주세요.'); setSaving(false); return }
        const phaseDto = phase === 'PRE_MATCH' ? buildPreDto() : buildPostDto()
        const result = await tacticalApi.create({ matchId: Number(matchId), phase, ...phaseDto })
        if (files.length > 0) {
          await tacticalApi.addMedia(result.id, files).catch(() => {
            toast.error('분석은 등록됐지만 파일 업로드에 실패했습니다.')
          })
        }
        toast.success('전술 분석이 등록됐습니다.')
      } else {
        const phaseDto: UpdateTacticalDto = phase === 'PRE_MATCH'
          ? {
              formation: formation,
              opponentFormation: opponentFormation,
              opponentKeyThreat: opponentKeyThreat,
              opponentWeakness: opponentWeakness,
              opponentKeyPlayer: opponentKeyPlayer,
              opponentAnalysis: opponentAnalysis,
            }
          : {
              formation: formation,
              tacticalCompliance: tacticalCompliance,
              concededAnalysis: concededAnalysis,
              momPlayerId: momPlayerId,
              momNote: momNote,
              improvementPlayerId: improvementPlayerId,
              improvementNote: improvementNote,
              opponentAnalysis: opponentAnalysis,
            }
        await tacticalApi.update(initial!.id, phaseDto)
        toast.success('전술 분석이 수정됐습니다.')
      }
      reset()
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'create'
    ? '전술 분석 등록'
    : phase === 'PRE_MATCH'
      ? '🛡️ 사전 전력 분석 수정'
      : '⚔️ 사후 경기 리뷰 수정'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false) } }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {/* ── 공통: 경기 + 시점 ── */}
          <div className="space-y-1.5">
            <Label>경기 *</Label>
            <Select value={matchId} onValueChange={setMatchId} disabled={mode === 'edit'}>
              <SelectTrigger>
                <SelectValue placeholder="경기 선택">
                  {matchId ? matchLabel(matches.find((m) => String(m.id) === matchId)!) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{matchLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>분석 시점 *</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as TacticalPhase)} disabled={mode === 'edit'}>
              <SelectTrigger>
                <SelectValue>{PHASE_LABEL[phase]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PHASES.map((p) => (
                  <SelectItem key={p} value={p}>{PHASE_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── PRE_MATCH: 🛡️ 사전 전력 분석 ── */}
          {phase === 'PRE_MATCH' && (
            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <p className="text-xs font-semibold text-blue-700">🛡️ 사전 전력 분석 — 상대팀 파악</p>
              <FormationSelect
                label="우리 팀 계획 포메이션"
                value={formation}
                onChange={setFormation}
              />
              <FormationSelect
                label="상대 팀 예상 포메이션"
                value={opponentFormation}
                onChange={setOpponentFormation}
              />
              <div className="space-y-1.5">
                <Label>상대 팀 빌드업/공격 전개 특징 (Key Threat)</Label>
                <Textarea
                  placeholder="예: 좌측 윙백의 오버래핑, 전방 압박 강도"
                  value={opponentKeyThreat}
                  onChange={(e) => setOpponentKeyThreat(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>상대 팀 수비 취약점 및 공략 포인트</Label>
                <Textarea
                  placeholder="예: 백라인 뒷공간, 세트피스 허용률"
                  value={opponentWeakness}
                  onChange={(e) => setOpponentWeakness(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>요주의 인물 (Opponent Key Player)</Label>
                <Input
                  placeholder="예: 10번 공격형 미드필더"
                  value={opponentKeyPlayer}
                  onChange={(e) => setOpponentKeyPlayer(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>기타 메모</Label>
                <Textarea
                  placeholder="추가 분석 내용"
                  value={opponentAnalysis}
                  onChange={(e) => setOpponentAnalysis(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* ── POST_MATCH: ⚔️ 사후 경기 리뷰 ── */}
          {phase === 'POST_MATCH' && (
            <div className="space-y-3 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
              <p className="text-xs font-semibold text-purple-700">⚔️ 사후 경기 리뷰 — 우리 팀 수행도</p>
              <FormationSelect
                label="우리 팀 실제 가동 포메이션"
                value={formation}
                onChange={setFormation}
              />
              <div className="space-y-1.5">
                <Label>전술 지시 이행도 평가</Label>
                <Textarea
                  placeholder="예: 전방 압박 이행 80%, 측면 전환 부족"
                  value={tacticalCompliance}
                  onChange={(e) => setTacticalCompliance(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>실점/위기 발생 원인 분석</Label>
                <Textarea
                  placeholder="예: 코너킥 수비 마크 이탈, 2선 압박 타이밍 지연"
                  value={concededAnalysis}
                  onChange={(e) => setConcededAnalysis(e.target.value)}
                  rows={2}
                />
              </div>
              <PlayerSelectRow
                label="수훈 선수 (MOM)"
                players={players}
                playerId={momPlayerId}
                note={momNote}
                onPlayerChange={setMomPlayerId}
                onNoteChange={setMomNote}
              />
              <PlayerSelectRow
                label="보완 필요 선수"
                players={players}
                playerId={improvementPlayerId}
                note={improvementNote}
                onPlayerChange={setImprovementPlayerId}
                onNoteChange={setImprovementNote}
              />
              <div className="space-y-1.5">
                <Label>기타 메모</Label>
                <Textarea
                  placeholder="추가 리뷰 내용"
                  value={opponentAnalysis}
                  onChange={(e) => setOpponentAnalysis(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* ── 파일 업로드 (create 모드만) ── */}
          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label>사진 / 영상</Label>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 mr-1.5" />파일 선택
              </Button>
              {files.length > 0 && (
                <div className="space-y-1 mt-1">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                      {previews[idx] ? (
                        <img src={previews[idx]} alt="" className="h-7 w-10 object-cover rounded shrink-0" />
                      ) : (
                        <span className="text-muted-foreground text-xs shrink-0">▶</span>
                      )}
                      <span className="flex-1 truncate text-xs">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : mode === 'create' ? '등록' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────

export function TacticalAnalysisPage() {
  const { user } = useCurrentUser()
  const [analyses, setAnalyses] = useState<TacticalAnalysis[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TacticalAnalysis | null>(null)

  const canWrite =
    user?.role === 'ADMIN' ||
    user?.role === 'COACHING_STAFF' ||
    (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'TACTICAL_ANALYST')

  const canConfirm = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'

  const fetchAnalyses = () =>
    tacticalApi
      .list()
      .then(setAnalyses)
      .catch(() => toast.error('전술 분석 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void fetchAnalyses()
    matchApi.list().then(setMatches).catch(() => null)
    playerApi.list().then(setPlayers).catch(() => null)
  }, [])

  const handleConfirm = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await tacticalApi.confirm(id)
      toast.success('전술 분석이 확정됐습니다.')
      setAnalyses((prev) => prev.map((a) => a.id === id ? { ...a, status: 'CONFIRMED' } : a))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '확정에 실패했습니다.')
    }
  }

  const handleRowClick = (a: TacticalAnalysis) => {
    if (!canWrite) return
    setEditTarget(a)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">전술 분석</h1>
          <p className="text-sm text-muted-foreground mt-0.5">경기 전·후 전술 분석 목록</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />전술 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : analyses.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 전술 분석이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>경기</TableHead>
                <TableHead className="w-24">시점</TableHead>
                <TableHead className="w-28">포메이션</TableHead>
                <TableHead className="w-20">상태</TableHead>
                <TableHead className="w-24 text-muted-foreground">작성자</TableHead>
                {canConfirm && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((a) => (
                <TableRow
                  key={a.id}
                  className={canWrite ? 'cursor-pointer' : ''}
                  onClick={() => handleRowClick(a)}
                >
                  <TableCell>
                    <div className="text-sm">{a.match.homeTeamName} vs {a.match.awayTeamName}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{formatDate(a.match.date)}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${PHASE_STYLE[a.phase]}`}>
                      {PHASE_LABEL[a.phase]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{a.formation ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.createdBy.nickname}</TableCell>
                  {canConfirm && (
                    <TableCell>
                      {a.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={(e) => handleConfirm(a.id, e)}
                        >
                          <Check className="h-3 w-3 mr-1" />확정
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

      {/* 등록 다이얼로그 */}
      <AnalysisFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        matches={matches}
        players={players}
        onSaved={() => {
          setCreateOpen(false)
          setLoading(true)
          void fetchAnalyses()
        }}
      />

      {/* 수정 다이얼로그 */}
      <AnalysisFormDialog
        mode="edit"
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null) }}
        matches={matches}
        players={players}
        initial={editTarget ?? undefined}
        onSaved={() => {
          setEditTarget(null)
          setLoading(true)
          void fetchAnalyses()
        }}
      />
    </div>
  )
}
```

- [x] **Step 2: TypeScript 컴파일 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | grep "tactical\|error TS"
```

Expected: 출력 없음

- [x] **Step 3: Commit**

```bash
git add football/src/pages/tactical/TacticalAnalysisPage.tsx
git commit -m "feat(tactical): PRE/POST phase-specific forms, edit dialog on row click"
```

---

## Self-Review

**Spec coverage:**
- ✅ PRE_MATCH 필드: opponentFormation, opponentKeyThreat, opponentWeakness, opponentKeyPlayer
- ✅ POST_MATCH 필드: tacticalCompliance, concededAnalysis, momPlayerId+Note, improvementPlayerId+Note
- ✅ formation — PRE: 계획 포메이션, POST: 실제 포메이션으로 라벨 분리
- ✅ FORMATION_OPTIONS Select 사용
- ✅ MOM/보완선수: Player 드롭다운 + 메모 Input
- ✅ 등록 다이얼로그 phase 분기 섹션
- ✅ 행 클릭 → edit 모드 다이얼로그
- ✅ edit 모드: 경기/시점 disabled
- ✅ 파일 업로드는 create 모드에서만 표시
- ✅ PATCH /:id 엔드포인트 + 권한 검증
- ✅ 단위 테스트 (update controller)

**Placeholder 없음** — 모든 단계에 실제 코드 포함됨

**Type consistency:**
- `UpdateTacticalDto` (FE) ↔ `UpdateAnalysisDto` (BE): 모든 필드명 일치
- `momPlayerId: string | null` (TacticalAnalysis) ↔ `momPlayerId?: string` (UpdateTacticalDto): 빈 문자열 → BE에서 null 변환
- `ANALYSIS_SELECT` const 객체: findAll()과 update() 모두 동일한 select 사용

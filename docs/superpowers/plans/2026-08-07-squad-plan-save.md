# Squad Planner Save (스쿼드 플래너 저장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let HEAD_COACH save the current squad formation and slot assignments per season, and restore them automatically on page mount.

**Architecture:** New `SquadPlan` model (one row per season, upsert) backed by a minimal CRUD API module (`GET /squad-plan?seasonId=X`, `PUT /squad-plan`). The frontend fetches the active season and saved plan on mount, restores placement if a saved plan exists (skipping unavailable player IDs silently), and adds an explicit Save button with dirty-state tracking. A `skipRebuildRef` ref prevents the formation-rebuild effect from overwriting restored placement immediately after load.

**Tech Stack:** Express + Prisma (PostgreSQL) + TypeScript (backend); React + shadcn/ui + react-i18next (frontend)

---

## File Map

| Action | Path |
|--------|------|
| Modify | `apps/api/prisma/schema.prisma` |
| Create | `apps/api/src/squad-plan/dto/squad-plan.dto.ts` |
| Create | `apps/api/src/squad-plan/squad-plan.repo.ts` |
| Create | `apps/api/src/squad-plan/squad-plan.service.ts` |
| Create | `apps/api/src/squad-plan/squad-plan.controller.ts` |
| Create | `apps/api/src/squad-plan/squad-plan.routes.ts` |
| Modify | `apps/api/src/apiRouter.ts` |
| Create | `football/src/services/squadPlan.service.ts` |
| Modify | `football/src/pages/squad/SquadPlannerPage.tsx` |
| Modify | `football/src/locales/ko/squad.json` |
| Modify | `football/src/locales/en/squad.json` |

---

### Task 1: Prisma model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Add SquadPlan model and Season back-relation**

Open `apps/api/prisma/schema.prisma`.

At the end of the `Season` model block (around line 765, after `monthlyOperationsSnapshots`), add the back-relation field:

```prisma
  squadPlan                MonthlyOperationsSnapshot[]  // already exists — just add below it:
  squadPlan                SquadPlan?
```

So the Season model's relation list becomes:

```prisma
model Season {
  id           Int          @id @default(autoincrement())
  name         String
  startDate    DateTime
  endDate      DateTime
  status       SeasonStatus @default(UPCOMING)
  wageCapType  WageCapType?
  wageCapValue Float?
  leagueLevel  LeagueLevel?
  leagueId     Int?

  league                   League?               @relation(fields: [leagueId], references: [id])
  matches                  Match[]
  trainingSessions         TrainingSession[]
  tacticalAnalyses         TacticalAnalysis[]
  developmentPlans         PlayerDevelopmentPlan[]
  financialReport          FinancialReport?
  operatingExpenses        OperatingExpense[]
  complianceCheck          SeasonComplianceCheck?
  monthlyBudgetSnapshots   MonthlyBudgetSnapshot[]
  monthlyOperationsSnapshots MonthlyOperationsSnapshot[]
  squadPlan                SquadPlan?
}
```

Then append the new model at the very end of the file (after the last model):

```prisma
model SquadPlan {
  id          Int      @id @default(autoincrement())
  seasonId    Int      @unique
  formation   String
  slots       Json
  updatedAt   DateTime @updatedAt
  updatedById Int

  season    Season @relation(fields: [seasonId], references: [id])
  updatedBy User   @relation(fields: [updatedById], references: [id])
}
```

- [x] **Step 2: Check User model for existing back-relations and add SquadPlan**

Run:
```bash
grep -n "SquadPlan\|squadPlan" apps/api/prisma/schema.prisma
```
Expected output: shows the two lines you just added (in Season and the new model). If the `User` model does not already reference `SquadPlan`, find the User model and add the relation. Run:
```bash
grep -n "^model User" apps/api/prisma/schema.prisma
```
Open that line and add `squadPlans SquadPlan[]` to the User model's relation list.

- [x] **Step 3: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_squad_plan
```

Expected: migration file created, `SquadPlan` table created in DB, Prisma client regenerated with `squadPlan` model available.

- [x] **Step 4: Verify generated client**

```bash
grep -r "squadPlan" apps/api/src/generated/client/index.d.ts | head -5
```
Expected: lines containing `squadPlan` in the PrismaClient type.

- [x] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add SquadPlan model — seasonId unique, slots Json"
```

---

### Task 2: API module — DTO, repo, service, controller, routes

**Files:**
- Create: `apps/api/src/squad-plan/dto/squad-plan.dto.ts`
- Create: `apps/api/src/squad-plan/squad-plan.repo.ts`
- Create: `apps/api/src/squad-plan/squad-plan.service.ts`
- Create: `apps/api/src/squad-plan/squad-plan.controller.ts`
- Create: `apps/api/src/squad-plan/squad-plan.routes.ts`

- [x] **Step 1: Create DTO file**

Create `apps/api/src/squad-plan/dto/squad-plan.dto.ts`:

```typescript
export interface SaveSquadPlanDto {
  seasonId: number
  formation: string
  /** Record<slotKey, playerId | null> */
  slots: Record<string, string | null>
}
```

- [x] **Step 2: Create repository**

Create `apps/api/src/squad-plan/squad-plan.repo.ts`:

```typescript
import { PrismaClient } from "../generated/client";
import { SaveSquadPlanDto } from "./dto/squad-plan.dto";

export class SquadPlanRepository {
  constructor(private prisma: PrismaClient) {}

  findBySeasonId(seasonId: number) {
    return this.prisma.squadPlan.findUnique({
      where: { seasonId },
      select: {
        id: true,
        seasonId: true,
        formation: true,
        slots: true,
        updatedAt: true,
        updatedBy: { select: { nickname: true } },
      },
    });
  }

  upsert(dto: SaveSquadPlanDto, updatedById: number) {
    return this.prisma.squadPlan.upsert({
      where: { seasonId: dto.seasonId },
      create: {
        seasonId: dto.seasonId,
        formation: dto.formation,
        slots: dto.slots,
        updatedById,
      },
      update: {
        formation: dto.formation,
        slots: dto.slots,
        updatedById,
      },
      select: {
        id: true,
        seasonId: true,
        formation: true,
        slots: true,
        updatedAt: true,
        updatedBy: { select: { nickname: true } },
      },
    });
  }
}
```

- [x] **Step 3: Create service**

Create `apps/api/src/squad-plan/squad-plan.service.ts`:

```typescript
import { AppError } from "../lib/appError";
import { SquadPlanRepository } from "./squad-plan.repo";
import { SaveSquadPlanDto } from "./dto/squad-plan.dto";

export class SquadPlanService {
  constructor(private repo: SquadPlanRepository) {}

  async get(seasonId: number) {
    return this.repo.findBySeasonId(seasonId);
  }

  async save(dto: SaveSquadPlanDto, updatedById: number) {
    if (!dto.seasonId || typeof dto.seasonId !== "number") {
      throw new AppError(400, "INVALID_SEASON_ID");
    }
    if (!dto.formation || typeof dto.formation !== "string") {
      throw new AppError(400, "INVALID_FORMATION");
    }
    if (!dto.slots || typeof dto.slots !== "object" || Array.isArray(dto.slots)) {
      throw new AppError(400, "INVALID_SLOTS");
    }
    return this.repo.upsert(dto, updatedById);
  }
}
```

- [x] **Step 4: Create controller**

Create `apps/api/src/squad-plan/squad-plan.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { requireUser } from "../lib/authMiddleware";
import { SquadPlanService } from "./squad-plan.service";

export class SquadPlanController {
  constructor(private service: SquadPlanService) {}

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = requireUser(req);
      const canRead =
        isAdminLike(role) || role === "COACHING_STAFF";
      if (!canRead) throw new AppError(403, "FORBIDDEN");

      const seasonId = Number(req.query["seasonId"]);
      if (!seasonId || isNaN(seasonId)) throw new AppError(400, "INVALID_SEASON_ID");

      const plan = await this.service.get(seasonId);
      // Return null (204 omitted — return 200 with null so the FE can distinguish "no plan" from error)
      res.status(200).json(plan ?? null);
    } catch (err) {
      next(err);
    }
  };

  save = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole, id: userId } = requireUser(req);
      const canSave =
        isAdminLike(role) ||
        (role === "COACHING_STAFF" && coachingRole === "HEAD_COACH");
      if (!canSave) throw new AppError(403, "FORBIDDEN");

      res.status(200).json(await this.service.save(req.body, userId));
    } catch (err) {
      next(err);
    }
  };
}
```

- [x] **Step 5: Create routes**

Create `apps/api/src/squad-plan/squad-plan.routes.ts`:

```typescript
import { Router } from "express";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { SquadPlanRepository } from "./squad-plan.repo";
import { SquadPlanService } from "./squad-plan.service";
import { SquadPlanController } from "./squad-plan.controller";

const router = Router();
const repo = new SquadPlanRepository(getPrisma());
const service = new SquadPlanService(repo);
const controller = new SquadPlanController(service);

router.get("/", auth, controller.get);
router.put("/", auth, controller.save);

export default router;
```

- [x] **Step 6: TypeScript compile check**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: no errors. If errors appear in `squad-plan.repo.ts` about `slots` type, add a cast: `slots: dto.slots as import("@prisma/client").Prisma.InputJsonValue`.

- [x] **Step 7: Commit**

```bash
git add apps/api/src/squad-plan/
git commit -m "feat(api): add squad-plan module (GET + PUT, HEAD_COACH write guard)"
```

---

### Task 3: Register router in apiRouter

**Files:**
- Modify: `apps/api/src/apiRouter.ts`

- [x] **Step 1: Add import**

In `apps/api/src/apiRouter.ts`, after the last import (currently `import opsReportRouter from "./ops-report/ops-report.routes";`), add:

```typescript
import squadPlanRouter from "./squad-plan/squad-plan.routes";
```

- [x] **Step 2: Register route**

After the last `apiRouter.use(...)` line (currently `apiRouter.use("/ops-reports", opsReportRouter);`), add:

```typescript
apiRouter.use("/squad-plan", squadPlanRouter);
```

- [x] **Step 3: Smoke-test the endpoint**

Start the API (or rely on the existing dev server) and run:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/squad-plan?seasonId=1" \
  -H "Cookie: <your-session-cookie>"
```

Expected: `200` (returns `null` if no plan saved yet) or `401` if no cookie — either is correct, not `404`.

- [x] **Step 4: Commit**

```bash
git add apps/api/src/apiRouter.ts
git commit -m "feat(api): register /squad-plan route"
```

---

### Task 4: Frontend service

**Files:**
- Create: `football/src/services/squadPlan.service.ts`

- [x] **Step 1: Create the service file**

Create `football/src/services/squadPlan.service.ts`:

```typescript
import { api } from './api'

export interface SquadPlanDto {
  id: number
  seasonId: number
  formation: string
  /** Record<slotKey, playerId | null> */
  slots: Record<string, string | null>
  updatedAt: string
  updatedBy: { nickname: string | null }
}

export interface SaveSquadPlanPayload {
  seasonId: number
  formation: string
  slots: Record<string, string | null>
}

export const squadPlanApi = {
  get: (seasonId: number) =>
    api.get<SquadPlanDto | null>(`/squad-plan?seasonId=${seasonId}`),

  save: (payload: SaveSquadPlanPayload) =>
    api.put<SquadPlanDto>('/squad-plan', payload),
}
```

- [x] **Step 2: Commit**

```bash
git add football/src/services/squadPlan.service.ts
git commit -m "feat(fe): add squadPlan.service.ts (get + save)"
```

---

### Task 5: SquadPlannerPage — dirty state, save button, restore on mount

**Files:**
- Modify: `football/src/pages/squad/SquadPlannerPage.tsx`

This task replaces the entire file with the updated version. Read the current file first to understand what stays, then apply these changes:

1. Import `useRef`, `useCallback` in addition to existing hooks.
2. Import `useCurrentUser` from `@/hooks/useCurrentUser`.
3. Import `seasonApi` from `@/services/season.service`.
4. Import `squadPlanApi` from `@/services/squadPlan.service`.
5. Import `Save` icon from `lucide-react`.
6. Import `Button` from `@/components/ui/button`.
7. Add states: `isDirty`, `savedSlots`, `saving`.
8. Add ref: `skipRebuildRef`.
9. Mount effect: also fetch `seasonApi.active()` and `squadPlanApi.get(seasonId)`, restore formation + placement from saved plan, set `skipRebuildRef.current = true` after restore.
10. Formation-rebuild effect: guard with `skipRebuildRef.current` — if true, reset ref and skip rebuild.
11. All user placement interactions set `isDirty = true`.
12. `handleSave` function: calls `squadPlanApi.save`, resets `isDirty`, updates `savedSlots`.
13. Save button in header (disabled unless `isDirty`, hidden unless `canSave`).

- [x] **Step 1: Write the updated SquadPlannerPage**

Replace `football/src/pages/squad/SquadPlannerPage.tsx` with:

```typescript
import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { playerApi } from '@/services/player.service'
import { injuryApi } from '@/services/injury.service'
import { tacticalApi } from '@/services/tactical.service'
import { seasonApi } from '@/services/season.service'
import { squadPlanApi } from '@/services/squadPlan.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Player, PositionZone } from '@/types/player'
import { POSITION_ZONE } from '@/types/player'
import type { InjuryStatus } from '@/types/injury'
import { AlertTriangle, Save } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FootballPitch } from '@/components/squad/FootballPitch'
import { FormationSlot } from '@/components/squad/FormationSlot'
import { PlayerBench } from '@/components/squad/PlayerBench'
import {
  FORMATION_LAYOUTS,
  SUPPORTED_FORMATIONS,
  type SupportedFormation,
} from '@/components/squad/formation-layouts'
import { getCandidates, buildInitialPlacement } from '@/components/squad/squad-utils'

type ViewMode = 'formation' | 'grid'

const ZONE_MIN: Record<PositionZone, number> = { GK: 2, DEF: 4, MID: 3, FWD: 2 }

interface ActiveInjury {
  playerId: string
  status: InjuryStatus
}

export function SquadPlannerPage() {
  const { t } = useTranslation('squad')
  const { user } = useCurrentUser()

  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [activeInjuries, setActiveInjuries] = useState<ActiveInjury[]>([])
  const [formation, setFormation] = useState<SupportedFormation>('4-3-3')
  const [viewMode, setViewMode] = useState<ViewMode>('formation')
  const [placement, setPlacement] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSlots, setSavedSlots] = useState<Record<string, string | null> | null>(null)
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null)

  // When true, the formation-rebuild effect skips one cycle (used after restoring a saved plan)
  const skipRebuildRef = useRef(false)

  const canSave =
    user !== null &&
    (user.role === 'ADMIN' ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'GM' ||
      (user.role === 'COACHING_STAFF' && user.coachingRole === 'HEAD_COACH'))

  const injuredIds = useMemo(
    () => new Set(activeInjuries.map((i) => i.playerId)),
    [activeInjuries],
  )

  const availablePlayers = useMemo(
    () => allPlayers.filter(
      (p) => p.status === 'ACTIVE' && p.level !== 'YOUTH' && !injuredIds.has(p.id),
    ),
    [allPlayers, injuredIds],
  )

  const squadWarnings = useMemo(() => {
    const counts: Record<PositionZone, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    availablePlayers.forEach((p) => { counts[POSITION_ZONE[p.position]]++ })
    return (['GK', 'DEF', 'MID', 'FWD'] as PositionZone[])
      .filter((z) => counts[z] < ZONE_MIN[z])
      .map((z) => ({ zone: z, count: counts[z], min: ZONE_MIN[z] }))
  }, [availablePlayers])

  useEffect(() => {
    Promise.all([
      playerApi.list({ status: 'ACTIVE' }),
      injuryApi.active(),
      tacticalApi.list(),
      seasonApi.active(),
    ])
      .then(async ([players, injuries, analyses, activeSeason]) => {
        setAllPlayers(players)
        setActiveInjuries(injuries)

        // Determine formation from last tactical analysis (fallback)
        const lastFormation = analyses[0]?.formation
        const supported = SUPPORTED_FORMATIONS.find((f) => f === lastFormation)

        // Try to restore saved plan if active season exists
        if (activeSeason) {
          setCurrentSeasonId(activeSeason.id)
          try {
            const savedPlan = await squadPlanApi.get(activeSeason.id)
            if (savedPlan) {
              // Restore formation from saved plan (takes priority over tactical analysis)
              const savedFormation = SUPPORTED_FORMATIONS.find((f) => f === savedPlan.formation)
              if (savedFormation) setFormation(savedFormation)
              else if (supported) setFormation(supported)

              // Build available player ID set for filtering out unavailable players
              const availablePlayerIds = new Set(
                players
                  .filter((p) => p.status === 'ACTIVE' && p.level !== 'YOUTH')
                  .filter((p) => !new Set(injuries.map((i: ActiveInjury) => i.playerId)).has(p.id))
                  .map((p) => p.id),
              )

              // Restore slots, silently clearing unavailable players
              const restoredPlacement: Record<string, string | null> = {}
              for (const [slotKey, playerId] of Object.entries(savedPlan.slots)) {
                restoredPlacement[slotKey] =
                  playerId !== null && availablePlayerIds.has(playerId) ? playerId : null
              }

              setSavedSlots(restoredPlacement)
              setPlacement(restoredPlacement)
              // Prevent formation-rebuild effect from overwriting restored placement
              skipRebuildRef.current = true
              return
            }
          } catch {
            // Failed to load saved plan — fall through to default behaviour
          }
        }

        // No saved plan: use tactical analysis formation + auto-placement
        if (supported) setFormation(supported)
      })
      .catch(() => toast.error(t('planner.loadFailed')))
      .finally(() => setLoading(false))
  }, [])

  // Rebuild placement when formation changes — skipped once after restoring a saved plan
  useEffect(() => {
    if (loading) return
    if (skipRebuildRef.current) {
      skipRebuildRef.current = false
      return
    }
    const slots = FORMATION_LAYOUTS[formation]
    setPlacement(buildInitialPlacement(slots, availablePlayers))
    setIsDirty(false)
  }, [formation, loading, availablePlayers])

  const slots = FORMATION_LAYOUTS[formation]

  const placedIds = useMemo(
    () => new Set(Object.values(placement).filter((id): id is string => id !== null)),
    [placement],
  )

  const handleConfirmSuggestion = (slotKey: string, playerId: string) => {
    setPlacement((prev) => ({ ...prev, [slotKey]: playerId }))
    setIsDirty(true)
  }

  const handleDrop = (toSlotKey: string, playerId: string, fromSlotKey: string | null) => {
    setPlacement((prev) => {
      const next = { ...prev }
      if (fromSlotKey) {
        const displaced = next[toSlotKey] ?? null
        next[toSlotKey] = playerId
        next[fromSlotKey] = displaced
      } else {
        next[toSlotKey] = playerId
      }
      return next
    })
    setIsDirty(true)
  }

  const handleRemove = (slotKey: string) => {
    setPlacement((prev) => ({ ...prev, [slotKey]: null }))
    setIsDirty(true)
  }

  const handleBenchDrop = (_playerId: string, fromSlotKey: string) => {
    setPlacement((prev) => ({ ...prev, [fromSlotKey]: null }))
    setIsDirty(true)
  }

  const handleFormationChange = (f: string) => {
    setFormation(f as SupportedFormation)
    // isDirty will be reset inside the formation-rebuild effect
  }

  const handleSave = useCallback(async () => {
    if (!currentSeasonId) {
      toast.error(t('planner.saveNoSeason'))
      return
    }
    setSaving(true)
    try {
      await squadPlanApi.save({
        seasonId: currentSeasonId,
        formation,
        slots: placement,
      })
      setSavedSlots(placement)
      setIsDirty(false)
      toast.success(t('planner.saveSuccess'))
    } catch {
      toast.error(t('planner.saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [currentSeasonId, formation, placement, t])

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  const filledCount = Object.values(placement).filter(Boolean).length
  const voidCount = slots.length - filledCount

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('planner.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('planner.available', { count: availablePlayers.length })} &nbsp;·&nbsp; {t('planner.injured', { count: injuredIds.size })}
            {voidCount > 0 && (
              <span className="ml-2 text-red-400 font-medium">{t('planner.emptySlots', { count: voidCount })}</span>
            )}
          </p>
          {squadWarnings.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {squadWarnings.map(({ zone, count, min }) => (
                <span
                  key={zone}
                  className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
                >
                  <AlertTriangle className="size-3 shrink-0" />
                  {t('planner.zoneWarning', { zone: t(`zone.${zone}`), count, min })}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canSave && (
            <Button
              size="sm"
              variant={isDirty ? 'default' : 'outline'}
              disabled={!isDirty || saving}
              onClick={handleSave}
              className="gap-1.5"
            >
              <Save className="size-3.5" />
              {saving ? t('planner.saving') : t('planner.save')}
            </Button>
          )}
          <Select value={formation} onValueChange={handleFormationChange}>
            <SelectTrigger className="w-32">
              <SelectValue>{formation}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_FORMATIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('formation')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'formation'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t('planner.formation')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t('planner.spanishGrid')}
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 피치 */}
        <div className="flex-1 p-4 overflow-auto flex items-start justify-center">
          <div className="w-full max-w-xs">
            <FootballPitch viewMode={viewMode}>
              {slots.map((slotDef) => {
                const placedId = placement[slotDef.key] ?? null
                const placedPlayer = placedId
                  ? (allPlayers.find((p) => p.id === placedId) ?? null)
                  : null
                const suggestedPlayer = placedId
                  ? null
                  : (getCandidates(slotDef.position, availablePlayers, placedIds)[0] ?? null)
                return (
                  <FormationSlot
                    key={slotDef.key}
                    slotDef={slotDef}
                    placedPlayer={placedPlayer}
                    suggestedPlayer={suggestedPlayer}
                    onConfirmSuggestion={handleConfirmSuggestion}
                    onDrop={handleDrop}
                    onRemove={handleRemove}
                  />
                )
              })}
            </FootballPitch>
          </div>
        </div>

        {/* 벤치 패널 */}
        <div className="w-44 shrink-0">
          <PlayerBench
            availablePlayers={availablePlayers}
            placedIds={placedIds}
            injuredPlayers={activeInjuries}
            allPlayers={allPlayers}
            onBenchDrop={handleBenchDrop}
          />
        </div>
      </div>
    </div>
  )
}
```

- [x] **Step 2: TypeScript compile check**

```bash
cd football && npx tsc --noEmit
```
Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add football/src/pages/squad/SquadPlannerPage.tsx
git commit -m "feat(fe): add save button + dirty state + plan restore to SquadPlannerPage"
```

---

### Task 6: i18n keys + PR step

**Files:**
- Modify: `football/src/locales/ko/squad.json`
- Modify: `football/src/locales/en/squad.json`

- [x] **Step 1: Add Korean i18n keys**

In `football/src/locales/ko/squad.json`, inside `"planner"`, add the following keys after `"loadFailed"`:

```json
"save": "저장",
"saving": "저장 중...",
"saveSuccess": "스쿼드 플랜이 저장되었습니다.",
"saveFailed": "저장에 실패했습니다.",
"saveNoSeason": "활성 시즌이 없습니다."
```

The final `"planner"` block should look like:

```json
"planner": {
  "title": "팀 빌더",
  "available": "가용 {{count}}명",
  "injured": "부상 {{count}}명",
  "emptySlots": "빈 슬롯 {{count}}개",
  "zoneWarning": "{{zone}} 가용 {{count}}명 (최소 {{min}}명)",
  "formation": "포메이션",
  "spanishGrid": "스페인 그리드",
  "loadFailed": "데이터를 불러오지 못했습니다.",
  "save": "저장",
  "saving": "저장 중...",
  "saveSuccess": "스쿼드 플랜이 저장되었습니다.",
  "saveFailed": "저장에 실패했습니다.",
  "saveNoSeason": "활성 시즌이 없습니다."
}
```

- [x] **Step 2: Add English i18n keys**

In `football/src/locales/en/squad.json`, inside `"planner"`, add after `"loadFailed"`:

```json
"save": "Save",
"saving": "Saving...",
"saveSuccess": "Squad plan saved.",
"saveFailed": "Failed to save squad plan.",
"saveNoSeason": "No active season found."
```

The final `"planner"` block should look like:

```json
"planner": {
  "title": "Team Builder",
  "available": "{{count}} available",
  "injured": "{{count}} injured",
  "emptySlots": "{{count}} empty slots",
  "zoneWarning": "{{zone}}: {{count}} available (min {{min}})",
  "formation": "Formation",
  "spanishGrid": "Spanish Grid",
  "loadFailed": "Failed to load data.",
  "save": "Save",
  "saving": "Saving...",
  "saveSuccess": "Squad plan saved.",
  "saveFailed": "Failed to save squad plan.",
  "saveNoSeason": "No active season found."
}
```

- [x] **Step 3: Commit i18n**

```bash
git add football/src/locales/ko/squad.json football/src/locales/en/squad.json
git commit -m "feat(i18n): add squad planner save keys (ko + en)"
```

- [x] **Step 4: Final compile check**

```bash
cd apps/api && npx tsc --noEmit && cd ../football && npx tsc --noEmit
```
Expected: both exit 0, no errors.

- [x] **Step 5: Open PR**

```bash
gh pr create \
  --title "feat: squad planner save (스쿼드 플래너 저장)" \
  --body "$(cat <<'EOF'
## Summary
- New `SquadPlan` Prisma model (seasonId unique, slots Json)
- `GET /squad-plan?seasonId=X` + `PUT /squad-plan` API module with HEAD_COACH write guard
- Frontend service `squadPlanApi` + dirty state + explicit Save button in SquadPlannerPage
- Auto-restore on mount; unavailable players silently cleared from restored slots

## Test plan
- [x] Log in as HEAD_COACH, open Squad Planner, drag players into slots, click Save — confirm toast success and page reload restores the same placement
- [x] Log in as ASSISTANT_COACH — confirm Save button is not rendered
- [x] Log in as ADMIN — confirm Save button is rendered and works
- [x] Injure a saved player, reload page — confirm their slot is empty with no error
- [x] Change formation — confirm Save button disappears (isDirty resets) and placement auto-rebuilds
- [x] Call `PUT /squad-plan` as ASSISTANT_COACH via curl — confirm 403
EOF
)"
```

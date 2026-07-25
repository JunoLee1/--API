# HEAD_COACH 코칭스태프 통합 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HEAD_COACH가 `/coaching-staff/management` 한 화면에서 소속 코칭스태프 현황·이번 주 세션 배정·이번 달 포지션별 성과를 조회하고, 스태프 카드에서 부재(CoachAvailability)를 인라인으로 등록/삭제한다.

**Architecture:** BE에 `GET /coaching-staff`(신규, COACHING_STAFF 유저 + 주간 부재 조인) 엔드포인트를 추가한다. FE는 신규 페이지 `StaffManagementPage`에서 세 섹션을 렌더링한다: ① 스태프 카드, ② 이번 주 세션 배정(기존 `trainingApi.list()` 재사용), ③ 코치별 포지션 성과(기존 `trainingApi.getResults()` + `COACH_POSITION_MAP` 재사용). 세션 담당자 판단은 `TrainingSession.createdById`를 사용한다(스키마 변경 없음).

**Tech Stack:** Express/Hono(BE), React + shadcn/ui(FE), Prisma, TypeScript

---

## 파일 구조

**신규 생성:**
- `apps/api/src/coaching-staff/coaching-staff.repo.ts` — DB 쿼리: COACHING_STAFF 유저 + 주간 CoachAvailability 조인
- `apps/api/src/coaching-staff/coaching-staff.service.ts` — 얇은 서비스 레이어
- `apps/api/src/coaching-staff/coaching-staff.controller.ts` — GET 핸들러, HEAD_COACH·ADMIN 접근 제한
- `apps/api/src/coaching-staff/coaching-staff.routes.ts` — 라우터
- `apps/api/__test__/coaching-staff/coaching-staff.service.test.ts` — 서비스 단위 테스트
- `football/src/types/coaching-staff.ts` — FE 타입
- `football/src/services/coaching-staff.service.ts` — FE API 클라이언트
- `football/src/pages/coaching-staff/StaffManagementPage.tsx` — 메인 페이지

**수정:**
- `apps/api/src/apiRouter.ts` — coachingStaffRouter 등록
- `football/src/App.tsx` — `/coaching-staff/management` 라우트 추가
- `football/src/layouts/AppShell.tsx` — `'코칭스태프'` 섹션 + `'스태프 관리'` 항목 추가

---

## Task 1: BE — repo + service (TDD)

**Files:**
- Create: `apps/api/src/coaching-staff/coaching-staff.repo.ts`
- Create: `apps/api/src/coaching-staff/coaching-staff.service.ts`
- Create: `apps/api/__test__/coaching-staff/coaching-staff.service.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// apps/api/__test__/coaching-staff/coaching-staff.service.test.ts
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { CoachingStaffService } from "../../src/coaching-staff/coaching-staff.service";

const mockRepo = {
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
} as any;

const service = new CoachingStaffService(mockRepo);

describe("CoachingStaffService.getAll", () => {
  beforeEach(() => jest.clearAllMocks());

  test("repo.findAll을 weekStart/weekEnd로 호출한다", async () => {
    const start = new Date("2026-07-21");
    const end = new Date("2026-07-27");
    mockRepo.findAll.mockResolvedValue([{ id: 1, nickname: "김코치" }]);

    const result = await service.getAll(start, end);

    expect(mockRepo.findAll).toHaveBeenCalledWith(start, end);
    expect(result).toHaveLength(1);
    expect(result[0].nickname).toBe("김코치");
  });

  test("빈 배열이면 빈 배열을 반환한다", async () => {
    mockRepo.findAll.mockResolvedValue([]);
    const result = await service.getAll(new Date(), new Date());
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 (FAIL 확인)**

```bash
cd apps/api && npx jest __test__/coaching-staff/coaching-staff.service.test.ts --verbose
```

Expected: FAIL — "Cannot find module '../../src/coaching-staff/coaching-staff.service'"

- [ ] **Step 3: repo 구현**

```typescript
// apps/api/src/coaching-staff/coaching-staff.repo.ts
import { PrismaClient } from "../generated/client";

export class CoachingStaffRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(weekStart: Date, weekEnd: Date) {
    return this.prisma.user.findMany({
      where: { role: "COACHING_STAFF", isDeleted: false },
      select: {
        id: true,
        nickname: true,
        coachingRole: true,
        teamId: true,
        coachAvailabilities: {
          where: {
            startDate: { lte: weekEnd },
            endDate: { gte: weekStart },
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            reason: true,
            createdById: true,
          },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { id: "asc" },
    });
  }
}
```

- [ ] **Step 4: service 구현**

```typescript
// apps/api/src/coaching-staff/coaching-staff.service.ts
import { CoachingStaffRepository } from "./coaching-staff.repo";

export class CoachingStaffService {
  constructor(private repo: CoachingStaffRepository) {}

  getAll(weekStart: Date, weekEnd: Date) {
    return this.repo.findAll(weekStart, weekEnd);
  }
}
```

- [ ] **Step 5: 테스트 재실행 (PASS 확인)**

```bash
cd apps/api && npx jest __test__/coaching-staff/coaching-staff.service.test.ts --verbose
```

Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/coaching-staff/ apps/api/__test__/coaching-staff/
git commit -m "feat(coaching-staff): add repo + service with weekly absence query"
```

---

## Task 2: BE — controller + routes + apiRouter 등록

**Files:**
- Create: `apps/api/src/coaching-staff/coaching-staff.controller.ts`
- Create: `apps/api/src/coaching-staff/coaching-staff.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: controller 작성**

```typescript
// apps/api/src/coaching-staff/coaching-staff.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { CoachingStaffService } from "./coaching-staff.service";

function getWeekBounds(refDate: Date): { start: Date; end: Date } {
  const day = refDate.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const start = new Date(refDate);
  start.setDate(refDate.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export class CoachingStaffController {
  constructor(private service: CoachingStaffService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, coachingRole } = req.user!;
      const isHeadCoach = role === "COACHING_STAFF" && coachingRole === "HEAD_COACH";
      if (role !== "ADMIN" && !isHeadCoach) {
        throw new AppError(403, "FORBIDDEN");
      }
      const ref = req.query["weekRef"] ? new Date(req.query["weekRef"] as string) : new Date();
      const { start, end } = getWeekBounds(ref);
      res.json(await this.service.getAll(start, end));
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 2: routes 작성**

```typescript
// apps/api/src/coaching-staff/coaching-staff.routes.ts
import { Router } from "express";
import passport from "passport";
import { CoachingStaffController } from "./coaching-staff.controller";
import { CoachingStaffService } from "./coaching-staff.service";
import { CoachingStaffRepository } from "./coaching-staff.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new CoachingStaffRepository(getPrisma());
const service = new CoachingStaffService(repo);
const controller = new CoachingStaffController(service);
const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getAll);

export default router;
```

- [ ] **Step 3: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts` 마지막 import 아래에 추가:
```typescript
import coachingStaffRouter from "./coaching-staff/coaching-staff.routes";
```

`apiRouter.use("/academy-fees", academyFeeRouter);` 아래에 추가:
```typescript
apiRouter.use("/coaching-staff", coachingStaffRouter);
```

- [ ] **Step 4: 기존 테스트 회귀 확인**

```bash
cd apps/api && npx jest --passWithNoTests 2>&1 | grep -E "Tests:|FAIL"
```

Expected: 실패 수 기존 기준 이상 증가 없음

- [ ] **Step 5: 수동 검증 (서버 실행 후)**

```bash
# 터미널 1: 서버 기동
cd apps/api && npm run dev

# 터미널 2: HEAD_COACH 토큰으로 호출
curl -s -H "Authorization: Bearer <head_coach_token>" \
  http://localhost:3000/api/coaching-staff | jq '.[0]'
```

Expected: `{ id, nickname, coachingRole, teamId, coachAvailabilities: [] }` 형태

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/coaching-staff/ apps/api/src/apiRouter.ts
git commit -m "feat(coaching-staff): add GET /coaching-staff endpoint (HEAD_COACH + ADMIN)"
```

---

## Task 3: FE — 타입 + API 서비스

**Files:**
- Create: `football/src/types/coaching-staff.ts`
- Create: `football/src/services/coaching-staff.service.ts`

- [ ] **Step 1: 타입 파일 작성**

```typescript
// football/src/types/coaching-staff.ts
import type { CoachingRole } from '@/types/auth'

export interface StaffAbsence {
  id: number
  startDate: string
  endDate: string
  reason: string | null
  createdById: number
}

export interface CoachingStaffMember {
  id: number
  nickname: string | null
  coachingRole: CoachingRole | null
  teamId: number | null
  coachAvailabilities: StaffAbsence[]
}
```

- [ ] **Step 2: API 서비스 작성**

```typescript
// football/src/services/coaching-staff.service.ts
import { api } from './api'
import type { CoachingStaffMember } from '@/types/coaching-staff'

function getWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

export const coachingStaffApi = {
  list: () => {
    const { weekStart, weekEnd } = getWeekRange()
    return api.get<CoachingStaffMember[]>(
      `/coaching-staff?weekRef=${weekStart}`,
    )
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add football/src/types/coaching-staff.ts football/src/services/coaching-staff.service.ts
git commit -m "feat(coaching-staff): add FE types and API service"
```

---

## Task 4: FE — StaffManagementPage (Section 1: 스태프 카드)

**Files:**
- Create: `football/src/pages/coaching-staff/StaffManagementPage.tsx`

Section 1은 페이지의 핵심이다. 각 COACHING_STAFF 유저를 카드로 표시하고, 이번 주 부재를 배지로 표시하며, HEAD_COACH는 부재를 인라인 등록/삭제할 수 있다.

- [ ] **Step 1: 페이지 파일 생성 (Section 1만)**

```tsx
// football/src/pages/coaching-staff/StaffManagementPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { coachingStaffApi } from '@/services/coaching-staff.service'
import { coachAvailabilityApi } from '@/services/coach-availability.service'
import type { CoachingStaffMember } from '@/types/coaching-staff'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { COACHING_ROLE_LABEL } from '@/types/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, X, UserCheck, UserX } from 'lucide-react'

function formatDateKR(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function isAbsentToday(absences: CoachingStaffMember['coachAvailabilities']) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return absences.some((a) => {
    const start = new Date(a.startDate)
    const end = new Date(a.endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return start <= today && today <= end
  })
}

interface AbsenceDialogProps {
  open: boolean
  onClose: () => void
  staffId: number
  onCreated: () => void
}

function AbsenceDialog({ open, onClose, staffId, onCreated }: AbsenceDialogProps) {
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!form.startDate || !form.endDate) {
      toast.error('날짜를 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await coachAvailabilityApi.create({
        userId: staffId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || undefined,
      })
      toast.success('부재 등록됐습니다.')
      setForm({ startDate: '', endDate: '', reason: '' })
      onCreated()
      onClose()
    } catch {
      toast.error('등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>부재 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>시작일 *</Label>
            <Input type="date" value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>종료일 *</Label>
            <Input type="date" value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>사유</Label>
            <Textarea rows={2} placeholder="사유 (선택)" value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={() => void handleCreate()} disabled={saving}>
            {saving ? '저장 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface StaffCardProps {
  member: CoachingStaffMember
  canEdit: boolean
  currentUserId: number
  onRefresh: () => void
}

function StaffCard({ member, canEdit, currentUserId, onRefresh }: StaffCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const absent = isAbsentToday(member.coachAvailabilities)

  const handleDeleteAbsence = async (absenceId: number) => {
    try {
      await coachAvailabilityApi.delete(absenceId)
      toast.success('삭제됐습니다.')
      onRefresh()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {absent
              ? <UserX className="h-4 w-4 text-destructive" />
              : <UserCheck className="h-4 w-4 text-green-600" />}
            <span className="font-medium text-sm">{member.nickname ?? '(닉네임 없음)'}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {member.coachingRole ? (COACHING_ROLE_LABEL[member.coachingRole] ?? member.coachingRole) : '—'}
          </p>
        </div>
        {canEdit && (
          <Button
            variant="ghost" size="icon" className="h-6 w-6 shrink-0"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {member.coachAvailabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {member.coachAvailabilities.map((a) => (
            <Badge key={a.id} variant="secondary" className="text-xs gap-1">
              {formatDateKR(a.startDate)}–{formatDateKR(a.endDate)}
              {a.reason && <span className="text-muted-foreground">· {a.reason}</span>}
              {(canEdit || a.createdById === currentUserId) && (
                <button
                  className="ml-0.5 hover:text-destructive"
                  onClick={() => void handleDeleteAbsence(a.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {dialogOpen && (
        <AbsenceDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          staffId={member.id}
          onCreated={onRefresh}
        />
      )}
    </div>
  )
}

export function StaffManagementPage() {
  const { user } = useCurrentUser()
  const [staff, setStaff] = useState<CoachingStaffMember[]>([])
  const [loading, setLoading] = useState(true)

  const canEdit = user?.role === 'ADMIN' || user?.coachingRole === 'HEAD_COACH'

  const fetchStaff = useCallback(() => {
    setLoading(true)
    coachingStaffApi
      .list()
      .then(setStaff)
      .catch(() => toast.error('스태프 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">스태프 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">코칭스태프 현황 · 세션 배정 · 성과</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Section 1: 스태프 현황 */}
        <section>
          <h2 className="text-sm font-semibold mb-3">이번 주 스태프 현황</h2>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 코칭스태프가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {staff.map((member) => (
                <StaffCard
                  key={member.id}
                  member={member}
                  canEdit={canEdit}
                  currentUserId={user?.id ?? 0}
                  onRefresh={fetchStaff}
                />
              ))}
            </div>
          )}
        </section>
        {/* Sections 2 & 3 추가 예정 */}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `COACHING_ROLE_LABEL` 임포트 확인**

```bash
grep -n "COACHING_ROLE_LABEL" /Users/juno/work/football/football/src/types/auth.ts | head -3
```

Expected: `COACHING_ROLE_LABEL` 익스포트 확인. 없으면 아래 타입 파일에서 직접 정의:
```typescript
// football/src/types/auth.ts 에 없으면 coaching-staff.ts에 추가
export const COACHING_ROLE_LABEL: Record<string, string> = {
  HEAD_COACH: '감독',
  ASSISTANT_COACH: '수석코치',
  DEFENSIVE_COACH: '수비코치',
  ATTACKING_COACH: '공격코치',
  GOALKEEPER_COACH: '골키퍼코치',
  PHYSICAL_COACH: '피지컬코치',
  SET_PIECE_COACH: '셋피스코치',
}
```

- [ ] **Step 3: Commit**

```bash
git add football/src/pages/coaching-staff/
git commit -m "feat(coaching-staff): add StaffManagementPage Section 1 staff cards"
```

---

## Task 5: FE — Section 2 (이번 주 세션 배정) + Section 3 (코치별 성과)

**Files:**
- Modify: `football/src/pages/coaching-staff/StaffManagementPage.tsx`

Section 2와 3은 기존 `trainingApi`를 재활용한다. 이 두 섹션을 하나의 태스크에서 추가한다.

- [ ] **Step 1: 주간 날짜 유틸 + 월간 날짜 유틸 추가 (파일 상단)**

`StaffManagementPage.tsx` 임포트 블록 아래, `formatDateKR` 위에 추가:

```typescript
import { trainingApi } from '@/services/training.service'
import type { TrainingSession } from '@/types/training'
import type { TrainingResultRow } from '@/types/training'
import { POSITION_LABEL } from '@/types/player'
import type { Position } from '@/types/player'
import { getCoachPositions } from '@/lib/coachPositionMap'
import type { CoachingRole } from '@/types/auth'

function getThisWeekRange(): { from: string; to: string; label: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const label = `${monday.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
  return { from: fmt(monday), to: fmt(sunday), label }
}

function getThisMonthRange(): { from: string; to: string; label: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const label = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
  return { from: fmt(first), to: fmt(last), label }
}
```

- [ ] **Step 2: Section 2, 3용 state + 데이터 페치 추가**

`StaffManagementPage` 함수 내 `staff` state 아래에 추가:

```typescript
const [sessions, setSessions] = useState<TrainingSession[]>([])
const [results, setResults] = useState<TrainingResultRow[]>([])
const [dataLoading, setDataLoading] = useState(true)
const week = getThisWeekRange()
const month = getThisMonthRange()
```

`useEffect` 안에서 `fetchStaff()` 호출과 함께 세션/결과도 병렬로 페치:

```typescript
useEffect(() => {
  fetchStaff()
  setDataLoading(true)
  Promise.all([
    trainingApi.list(),
    trainingApi.getResults({ from: month.from, to: month.to }),
  ])
    .then(([allSessions, allResults]) => {
      // 이번 주 세션만 필터링
      setSessions(
        allSessions.filter((s) => {
          const d = s.date.slice(0, 10)
          return d >= week.from && d <= week.to
        }),
      )
      setResults(allResults)
    })
    .catch(() => toast.error('데이터를 불러오지 못했습니다.'))
    .finally(() => setDataLoading(false))
}, [fetchStaff])
```

- [ ] **Step 3: Section 2 컴포넌트 — 이번 주 세션 배정**

`StaffManagementPage` return 문에서 `{/* Sections 2 & 3 추가 예정 */}` 를 아래로 교체:

```tsx
{/* Section 2: 이번 주 세션 배정 */}
<section>
  <h2 className="text-sm font-semibold mb-1">이번 주 세션 배정</h2>
  <p className="text-xs text-muted-foreground mb-3">{week.label}</p>
  {dataLoading ? (
    <Skeleton className="h-32 w-full" />
  ) : sessions.length === 0 ? (
    <p className="text-sm text-muted-foreground">이번 주 등록된 세션이 없습니다.</p>
  ) : (
    <div className="space-y-2">
      {staff.map((member) => {
        const mySessions = sessions.filter((s) => s.createdById === member.id)
        if (mySessions.length === 0) return null
        return (
          <div key={member.id} className="rounded-md border px-4 py-3">
            <p className="text-xs font-semibold mb-1.5">
              {member.nickname ?? '—'} · {member.coachingRole ? (COACHING_ROLE_LABEL[member.coachingRole] ?? member.coachingRole) : '—'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {mySessions.map((s) => (
                <Badge key={s.id} variant="outline" className="text-xs">
                  {s.date.slice(5, 10)} {s.sessionType.replace(/_/g, ' ')} — {s.goal.slice(0, 20)}{s.goal.length > 20 ? '…' : ''}
                </Badge>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )}
</section>

{/* Section 3: 코치별 포지션 성과 */}
<section>
  <h2 className="text-sm font-semibold mb-1">코치별 포지션 성과</h2>
  <p className="text-xs text-muted-foreground mb-3">{month.label} 훈련 결과 기준</p>
  {dataLoading ? (
    <Skeleton className="h-40 w-full" />
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {staff
        .filter((m) => m.coachingRole && getCoachPositions(m.coachingRole as CoachingRole))
        .map((member) => {
          const positions = getCoachPositions(member.coachingRole as CoachingRole) ?? []
          const posResults = results.filter(
            (r) => positions.includes(r.player.position as Position) && r.performanceScore != null,
          )
          const avg =
            posResults.length > 0
              ? (posResults.reduce((sum, r) => sum + (r.performanceScore ?? 0), 0) / posResults.length).toFixed(1)
              : null

          return (
            <div key={member.id} className="rounded-md border px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  {member.nickname ?? '—'} · {member.coachingRole ? (COACHING_ROLE_LABEL[member.coachingRole] ?? member.coachingRole) : '—'}
                </p>
                {avg != null ? (
                  <span className="text-lg font-bold tabular-nums">{avg}<span className="text-xs font-normal text-muted-foreground">점</span></span>
                ) : (
                  <span className="text-xs text-muted-foreground">데이터 없음</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                담당: {positions.map((p) => POSITION_LABEL[p] ?? p).join(', ')}
              </p>
              <p className="text-xs text-muted-foreground">
                평가 결과 {posResults.length}건
              </p>
            </div>
          )
        })}
    </div>
  )}
</section>
```

- [ ] **Step 4: Commit**

```bash
git add football/src/pages/coaching-staff/StaffManagementPage.tsx
git commit -m "feat(coaching-staff): add Section 2 weekly sessions and Section 3 coach performance"
```

---

## Task 6: FE — 라우트 + 네비게이션 연결

**Files:**
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [ ] **Step 1: App.tsx에 라우트 추가**

`App.tsx`에서 `HiringRoundsPage` import 아래에 추가:
```typescript
import { StaffManagementPage } from '@/pages/coaching-staff/StaffManagementPage'
```

`<Route path="/coaches/:id" element={...} />` 아래에 추가:
```tsx
<Route path="/coaching-staff/management" element={<StaffManagementPage />} />
```

- [ ] **Step 2: AppShell.tsx — 섹션 타입 확장**

`AppShell.tsx`에서 섹션 타입 정의를 찾아 `'코칭스태프'`를 추가:

```typescript
// Before
section?: '선수 관리' | '계약·영입' | '부상·의료' | '훈련' | '경기·분석' | '유소년' | '관리'
// After
section?: '선수 관리' | '계약·영입' | '부상·의료' | '훈련' | '경기·분석' | '유소년' | '코칭스태프' | '관리'
```

`SECTION_ORDER` 배열에 `'코칭스태프'`를 `'유소년'` 뒤에 추가:
```typescript
const SECTION_ORDER = [
  '선수 관리', '계약·영입', '부상·의료', '훈련', '경기·분석', '유소년', '코칭스태프', '관리',
]
```

- [ ] **Step 3: AppShell.tsx — 네비게이션 항목 추가**

AppShell.tsx import 블록에 `Users2` 아이콘이 없으면 추가:
```typescript
import { ..., Users2 } from 'lucide-react'
```

NAV_ITEMS 배열에서 `'유소년'` 섹션 마지막 항목 아래에 추가:
```typescript
{
  to: '/coaching-staff/management',
  label: '스태프 관리',
  icon: Users2,
  section: '코칭스태프',
  roles: ['ADMIN', 'COACHING_STAFF'],
  coachingRoles: ['HEAD_COACH'],
},
```

- [ ] **Step 4: TypeScript 빌드 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 5: 브라우저에서 검증**

```bash
cd football && npm run dev
```

1. HEAD_COACH 계정으로 로그인 → 좌측 네비에 `'코칭스태프'` 섹션 + `'스태프 관리'` 항목 확인
2. `'스태프 관리'` 클릭 → `/coaching-staff/management` 이동 확인
3. 스태프 카드 표시, `+` 버튼 클릭 → 부재 등록 다이얼로그 확인
4. 부재 배지 `×` 클릭 → 삭제 후 카드 갱신 확인
5. Section 2: 이번 주 세션이 코치별로 그룹핑 표시 확인
6. Section 3: 담당 포지션별 평균 점수 카드 확인

- [ ] **Step 6: Commit**

```bash
git add football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(coaching-staff): wire route /coaching-staff/management and nav section"
```

---

## Self-Review

**Spec coverage:**
- ✅ HEAD_COACH·ADMIN 접근 제한 (controller에서 coachingRole 체크)
- ✅ 네비게이션 섹션 '코칭스태프' + 항목 '스태프 관리'
- ✅ Section 1: COACHING_STAFF 유저 카드 + 이번 주 부재 배지 + 오늘 부재 아이콘
- ✅ 부재 인라인 등록 (AbsenceDialog, userId = card의 staffId)
- ✅ 부재 인라인 삭제 (HEAD_COACH 전체, 본인 등록 건은 자신도 삭제 가능)
- ✅ Section 2: 이번 주 세션을 createdById 기준 코치별 그룹핑 (스키마 변경 없음)
- ✅ Section 3: 이번 달 훈련 결과 + COACH_POSITION_MAP으로 코치별 평균 점수 계산

**확인 필요:**
- `COACHING_ROLE_LABEL`가 `football/src/types/auth.ts`에 이미 있는지 Task 4 Step 2에서 확인 후 중복 정의 방지
- Section 3은 `getCoachPositions()` 반환값이 null인 HEAD_COACH·ASSISTANT_COACH·PHYSICAL_COACH·SET_PIECE_COACH는 카드를 렌더링하지 않음 (의도된 동작 — 이 역할들은 담당 포지션이 없어 성과 집계 대상 아님)
- `trainingApi.list()`는 전체 세션을 가져오므로 시즌이 많으면 느릴 수 있음. 현재 데이터 규모에선 FE 필터링으로 충분하나, 필요 시 `from/to` 파라미터를 훈련 API에 추가하는 것을 고려할 것

# 코칭 역할별 훈련 세션 Pre-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 훈련 등록 다이얼로그에서 코치의 역할(coachingRole)에 따라 SessionType 기본값과 세션 구성 템플릿을 자동으로 pre-fill한다.

**Architecture:** FE 전용 변경. `TrainingPage.tsx`의 `CreateSessionDialog`에 `coachingRole` prop을 추가하고, `CoachingRole → SessionType` 매핑과 `SessionType → ContentRow[]` 템플릿 상수를 정의한다. SessionType이 변경되면 contents가 해당 템플릿으로 자동 교체된다.

**Tech Stack:** React, TypeScript, `football/src/types/auth.ts` (CoachingRole), `football/src/types/training.ts` (SessionType, ContentPhase, PHASE_LABEL)

---

## File Structure

- Modify: `football/src/pages/training/TrainingPage.tsx`
  - `CreateSessionDialogProps`에 `coachingRole?: CoachingRole | null` 추가
  - `DEFAULT_SESSION_TYPE` 상수 추가 (CoachingRole → SessionType)
  - `SESSION_CONTENT_TEMPLATE` 상수 추가 (SessionType → ContentRow[])
  - `CreateSessionDialog` 내 sessionType 초기값을 coachingRole 기반으로 변경
  - sessionType 변경 시 contents 자동 교체

---

### Task 1: CoachingRole → SessionType 매핑 + 템플릿 상수 추가

**Files:**
- Modify: `football/src/pages/training/TrainingPage.tsx`

**배경 지식:**
- `CoachingRole` 타입: `football/src/types/auth.ts` — `HEAD_COACH | ASSISTANT_COACH | DEFENSIVE_COACH | ATTACKING_COACH | PHYSICAL_COACH | SET_PIECE_COACH | GOALKEEPER_COACH | MEDICAL | MEDICAL_DIRECTOR`
- `SessionType` 타입: `football/src/types/training.ts` — `INDIVIDUAL_SKILL | TACTICAL_DEFENSIVE | TACTICAL_ATTACKING | TACTICAL_FULL_TEAM | PHYSICAL`
- `ContentPhase` 타입: `football/src/types/training.ts` — `WARMUP | DRILL | TACTICAL | GAME`
- `ContentRow` 타입: 현재 파일 안에 `type ContentRow = { phase: ContentPhase; description: string }` 로 정의돼 있음

- [x] **Step 1: `CoachingRole` import 추가**

파일 상단의 import 블록에 추가:
```typescript
import type { CoachingRole } from '@/types/auth'
```

현재 import 위치 (`football/src/pages/training/TrainingPage.tsx:6`):
```typescript
import type { TrainingSession, SessionType, ContentPhase } from '@/types/training'
import { SESSION_TYPE_LABEL, SESSION_TYPE_STYLE, PHASE_LABEL } from '@/types/training'
import type { Season } from '@/types/season'
```
변경 후:
```typescript
import type { CoachingRole } from '@/types/auth'
import type { TrainingSession, SessionType, ContentPhase } from '@/types/training'
import { SESSION_TYPE_LABEL, SESSION_TYPE_STYLE, PHASE_LABEL } from '@/types/training'
import type { Season } from '@/types/season'
```

- [x] **Step 2: 상수 두 개를 `SESSION_TYPES` 상수 바로 아래에 추가**

현재 위치 (`football/src/pages/training/TrainingPage.tsx`):
```typescript
const SESSION_TYPES = Object.keys(SESSION_TYPE_LABEL) as SessionType[]
const PAGE_SIZE = 10
```

변경 후:
```typescript
const SESSION_TYPES = Object.keys(SESSION_TYPE_LABEL) as SessionType[]
const PAGE_SIZE = 10

const DEFAULT_SESSION_TYPE: Partial<Record<CoachingRole, SessionType>> = {
  DEFENSIVE_COACH: 'TACTICAL_DEFENSIVE',
  ATTACKING_COACH: 'TACTICAL_ATTACKING',
  PHYSICAL_COACH: 'PHYSICAL',
  GOALKEEPER_COACH: 'INDIVIDUAL_SKILL',
}

type ContentRow = { phase: ContentPhase; description: string }

const SESSION_CONTENT_TEMPLATE: Record<SessionType, ContentRow[]> = {
  TACTICAL_DEFENSIVE: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '수비 블록 훈련' },
    { phase: 'TACTICAL', description: '수비 진형 조직' },
    { phase: 'GAME', description: '수비 압박 모의게임' },
  ],
  TACTICAL_ATTACKING: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '공격 조합 훈련' },
    { phase: 'TACTICAL', description: '공격 전개 패턴' },
    { phase: 'GAME', description: '공격 모의게임' },
  ],
  TACTICAL_FULL_TEAM: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '포지션별 드릴' },
    { phase: 'TACTICAL', description: '전술 훈련' },
    { phase: 'GAME', description: '전술 모의게임' },
  ],
  PHYSICAL: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '체력 훈련' },
    { phase: 'GAME', description: '마무리 훈련' },
  ],
  INDIVIDUAL_SKILL: [
    { phase: 'WARMUP', description: '준비운동 및 스트레칭' },
    { phase: 'DRILL', description: '개인기 훈련' },
    { phase: 'DRILL', description: '포지션별 집중 훈련' },
  ],
}
```

> 주의: 기존 파일에 `type ContentRow = { phase: ContentPhase; description: string }` 가 `CreateSessionDialog` 함수 **내부**에 정의돼 있음. 상수를 파일 최상위로 옮기면 중복 정의가 생기므로, 함수 내부의 `type ContentRow` 선언을 **삭제**해야 한다.

- [x] **Step 3: 기존 `type ContentRow` 인라인 선언 제거**

`CreateSessionDialog` 함수 안의 아래 줄을 삭제:
```typescript
type ContentRow = { phase: ContentPhase; description: string }
const PHASES = Object.keys(PHASE_LABEL) as ContentPhase[]
```
`PHASES`는 파일 최상위로 이동:
```typescript
const PHASES = Object.keys(PHASE_LABEL) as ContentPhase[]
```
`PAGE_SIZE` 아래, `DEFAULT_SESSION_TYPE` 위에 추가.

최종 상수 순서:
```typescript
const SESSION_TYPES = Object.keys(SESSION_TYPE_LABEL) as SessionType[]
const PHASES = Object.keys(PHASE_LABEL) as ContentPhase[]
const PAGE_SIZE = 10

const DEFAULT_SESSION_TYPE: Partial<Record<CoachingRole, SessionType>> = { ... }

type ContentRow = { phase: ContentPhase; description: string }

const SESSION_CONTENT_TEMPLATE: Record<SessionType, ContentRow[]> = { ... }
```

- [x] **Step 4: TypeScript 타입 체크**

```bash
npx tsc --noEmit --project football/tsconfig.app.json 2>&1 | grep "TrainingPage"
```

Expected: 출력 없음 (에러 없음)

- [x] **Step 5: Commit**

```bash
git add football/src/pages/training/TrainingPage.tsx
git commit -m "feat(training): add coaching role session type and content template constants"
```

---

### Task 2: CreateSessionDialog에 pre-fill 로직 적용

**Files:**
- Modify: `football/src/pages/training/TrainingPage.tsx`

**배경 지식:**
- `CreateSessionDialogProps`는 현재 `open, onOpenChange, seasons, activeSeason, onSaved`만 받음
- 부모 컴포넌트 `TrainingPage`는 이미 `const { user } = useCurrentUser()`로 user를 가지고 있음
- `user.coachingRole`은 `CoachingRole | null`

- [x] **Step 1: `CreateSessionDialogProps`에 `coachingRole` 추가**

```typescript
interface CreateSessionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  seasons: Season[]
  activeSeason: Season | null
  onSaved: () => void
  coachingRole?: CoachingRole | null
}
```

- [x] **Step 2: `CreateSessionDialog` 함수 시그니처 + sessionType 초기값 변경**

현재:
```typescript
function CreateSessionDialog({ open, onOpenChange, seasons, activeSeason, onSaved }: CreateSessionDialogProps) {
  const [date, setDate] = useState('')
  const [goal, setGoal] = useState('')
  const [sessionType, setSessionType] = useState<SessionType>('TACTICAL_FULL_TEAM')
  const [seasonId, setSeasonId] = useState<string>(activeSeason ? String(activeSeason.id) : '')
  const [contents, setContents] = useState<ContentRow[]>([])
  const [newPhase, setNewPhase] = useState<ContentPhase>('WARMUP')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
```

변경 후:
```typescript
function CreateSessionDialog({ open, onOpenChange, seasons, activeSeason, onSaved, coachingRole }: CreateSessionDialogProps) {
  const defaultType: SessionType =
    (coachingRole && DEFAULT_SESSION_TYPE[coachingRole]) ?? 'TACTICAL_FULL_TEAM'

  const [date, setDate] = useState('')
  const [goal, setGoal] = useState('')
  const [sessionType, setSessionType] = useState<SessionType>(defaultType)
  const [seasonId, setSeasonId] = useState<string>(activeSeason ? String(activeSeason.id) : '')
  const [contents, setContents] = useState<ContentRow[]>(() => SESSION_CONTENT_TEMPLATE[defaultType])
  const [newPhase, setNewPhase] = useState<ContentPhase>('WARMUP')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
```

- [x] **Step 3: 다이얼로그 열릴 때 상태 초기화 (open 변경 시)**

현재 `addContent` 함수 바로 위에 추가:
```typescript
useEffect(() => {
  if (open) {
    const t = (coachingRole && DEFAULT_SESSION_TYPE[coachingRole]) ?? 'TACTICAL_FULL_TEAM'
    setSessionType(t)
    setContents(SESSION_CONTENT_TEMPLATE[t])
    setDate('')
    setGoal('')
    setSeasonId(activeSeason ? String(activeSeason.id) : '')
    setNewDesc('')
  }
}, [open])
```

> `open`이 `true`가 될 때마다 초기화하여, 다이얼로그를 닫았다 다시 열면 이전 입력이 남지 않는다.

- [x] **Step 4: SessionType 변경 시 템플릿 자동 교체**

현재 Select의 `onValueChange`:
```typescript
<Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)} items={SESSION_TYPE_LABEL}>
```

변경 후:
```typescript
<Select
  value={sessionType}
  onValueChange={(v) => {
    const t = v as SessionType
    setSessionType(t)
    setContents(SESSION_CONTENT_TEMPLATE[t])
  }}
  items={SESSION_TYPE_LABEL}
>
```

- [x] **Step 5: 부모 `TrainingPage`에서 `coachingRole` prop 전달**

`TrainingPage` 컴포넌트 안의 `<CreateSessionDialog ... />` 호출부:

현재:
```typescript
<CreateSessionDialog
  open={createOpen}
  onOpenChange={setCreateOpen}
  seasons={seasons}
  activeSeason={activeSeason}
  onSaved={() => {
    setCreateOpen(false)
    const sid = selectedSeasonId === 'ALL' ? undefined : Number(selectedSeasonId)
    fetchSessions(sid)
  }}
/>
```

변경 후:
```typescript
<CreateSessionDialog
  open={createOpen}
  onOpenChange={setCreateOpen}
  seasons={seasons}
  activeSeason={activeSeason}
  coachingRole={user?.coachingRole}
  onSaved={() => {
    setCreateOpen(false)
    const sid = selectedSeasonId === 'ALL' ? undefined : Number(selectedSeasonId)
    fetchSessions(sid)
  }}
/>
```

- [x] **Step 6: TypeScript 타입 체크**

```bash
npx tsc --noEmit --project football/tsconfig.app.json 2>&1 | grep "TrainingPage"
```

Expected: 출력 없음

- [x] **Step 7: 수동 동작 확인**

개발 서버 실행 후 다음 시나리오를 직접 검증:

1. **수비코치 계정 로그인** → 훈련 등록 클릭 → SessionType이 `수비 전술`로 pre-fill, 세션 구성에 4개 항목 자동 입력 확인
2. **SessionType 변경** (`수비 전술` → `공격 전술`) → 세션 구성이 공격 템플릿으로 자동 교체 확인
3. **다이얼로그 닫기 후 재오픈** → 이전 수정 내용 없이 다시 초기값으로 리셋 확인
4. **ADMIN 계정** (coachingRole = null) → SessionType 기본값이 `전체 전술`인지 확인
5. **골키퍼코치 계정** → SessionType 기본값이 `개인 기술`인지 확인

- [x] **Step 8: Commit**

```bash
git add football/src/pages/training/TrainingPage.tsx
git commit -m "feat(training): pre-fill session type and contents template by coaching role"
```

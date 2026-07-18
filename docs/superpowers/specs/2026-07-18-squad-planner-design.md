# 팀 빌더 (Visual Squad Planner) 설계

**날짜:** 2026-07-18  
**범위:** `SquadPlanner` 모듈 — 시각적 포메이션 뷰, 스페인식 5×3 그리드 뷰, 드래그 앤 드롭 배치, 스카우팅 CTA

---

## 목표

감독/단장이 가용 선수 기반의 포메이션을 시각적으로 구성하고, 부족한 포지션(빈 슬롯)을 즉시 파악하여 스카우팅 액션으로 연결할 수 있는 플래너.

---

## 아키텍처

**FE 중심 기능** — BE 소규모 추가 1건 포함.

### BE 추가: `GET /injuries/active`

기존 `injuryApi`에 전체 활성 부상 목록 엔드포인트가 없어 추가 필요.

```
GET /injuries/active
→ [{ playerId: string, status: InjuryStatus }]
  (status ∈ [OCCURRED, DIAGNOSED, REHABILITATING]인 건만 반환)
```

FE `injuryApi`에 `active()` 메서드 추가.

### 데이터 흐름

```
페이지 진입
  ├─ playerApi.list({ status: 'ACTIVE' })
  │    → level !== 'YOUTH' 추가 필터 (client-side)
  ├─ injuryApi.active()                       ← 신규 엔드포인트
  │    → 부상 중 선수 ID Set 추출
  └─ tacticalApi.list()
       → 최신 1건의 formation → 초기 포메이션 기본값

세 결과 조합 → availablePlayers (가용 선수 목록)
```

**가용 선수 조건:**
- `PlayerStatus === 'ACTIVE'`
- `PlayerLevel !== 'YOUTH'`
- 현재 부상 상태 `∉ [OCCURRED, DIAGNOSED, REHABILITATING]`
- `PlayerStatus !== 'ON_LOAN'` (status ACTIVE 필터로 자동 배제)

---

## 파일 구조

**신규 생성:**
```
football/src/pages/squad/
  SquadPlannerPage.tsx

football/src/components/squad/
  FootballPitch.tsx
  FormationSlot.tsx
  PlayerBench.tsx
  formation-layouts.ts
  adjacent-positions.ts
```

**수정:**
```
football/src/App.tsx              — /squad 라우트 추가
football/src/components/layout/Sidebar.tsx (또는 nav)  — 메뉴 항목 추가
```

---

## 컴포넌트 상세

### SquadPlannerPage

**상태:**
```ts
formation: string                              // 현재 선택 포메이션 (default: 최근 TacticalAnalysis)
viewMode: 'formation' | 'grid'                 // 뷰 토글
placement: Record<string, string | null>       // slotKey → playerId | null
```

**헤더 컨트롤:**
```
[포메이션 드롭다운 ▼]   [포메이션 뷰 | 스페인 그리드]   가용: N명 / 부상: N명
```

포메이션 변경 시 `placement` 초기화.

---

### formation-layouts.ts

포메이션별 슬롯 좌표 정의 (피치 위에서 `top` / `left` %, GK가 bottom):

```ts
export interface SlotDef {
  key: string          // 'GK', 'CB1', 'LB', ...
  position: Position   // 매칭할 Position enum
  top: number          // % (0=top, 100=bottom)
  left: number         // % (0=left, 100=right)
  gridZone: GridZone   // 5×3 그리드 구역
}

export type GridZone = {
  col: 1 | 2 | 3 | 4 | 5   // 1=Left Channel, 2=Left Half-space, 3=Center, 4=Right Half-space, 5=Right Channel
  row: 1 | 2 | 3             // 1=공격, 2=미드, 3=수비
}
```

지원 포메이션: `4-3-3`, `4-4-2`, `4-2-3-1`, `4-1-4-1`, `3-5-2`, `3-4-3`, `5-3-2`, `5-4-1`  
(각 포메이션 = 11 슬롯)

**예시 (4-3-3):**
```ts
{ key: 'GK',   position: 'GOALKEEPER',       top: 88, left: 50, gridZone: { col: 3, row: 3 } },
{ key: 'LB',   position: 'LEFT_FULL_BACK',   top: 72, left: 15, gridZone: { col: 1, row: 3 } },
{ key: 'CB1',  position: 'CENTER_BACK',      top: 72, left: 35, gridZone: { col: 2, row: 3 } },
{ key: 'CB2',  position: 'CENTER_BACK',      top: 72, left: 65, gridZone: { col: 4, row: 3 } },
{ key: 'RB',   position: 'RIGHT_FULL_BACK',  top: 72, left: 85, gridZone: { col: 5, row: 3 } },
{ key: 'LCM',  position: 'CENTRAL_DEFENSIVE_MIDFIELDER', top: 52, left: 28, gridZone: { col: 2, row: 2 } },
{ key: 'CM',   position: 'CENTRAL_DEFENSIVE_MIDFIELDER', top: 52, left: 50, gridZone: { col: 3, row: 2 } },
{ key: 'RCM',  position: 'CENTRAL_DEFENSIVE_MIDFIELDER', top: 52, left: 72, gridZone: { col: 4, row: 2 } },
{ key: 'LW',   position: 'WINGER',           top: 30, left: 18, gridZone: { col: 1, row: 1 } },
{ key: 'ST',   position: 'STRIKER',          top: 22, left: 50, gridZone: { col: 3, row: 1 } },
{ key: 'RW',   position: 'WINGER',           top: 30, left: 82, gridZone: { col: 5, row: 1 } },
```

---

### adjacent-positions.ts

우선순위 큐 fallback용 인접 포지션 맵:

```ts
export const ADJACENT_POSITIONS: Partial<Record<Position, Position[]>> = {
  CENTER_BACK:                   ['LEFT_FULL_BACK', 'RIGHT_FULL_BACK'],
  LEFT_FULL_BACK:                ['LEFT_WING_BACK', 'CENTER_BACK'],
  RIGHT_FULL_BACK:               ['RIGHT_WING_BACK', 'CENTER_BACK'],
  LEFT_WING_BACK:                ['LEFT_FULL_BACK', 'WINGER'],
  RIGHT_WING_BACK:               ['RIGHT_FULL_BACK', 'WINGER'],
  CENTRAL_DEFENSIVE_MIDFIELDER:  ['LEFT_DEFENSIVE_MIDFIELDER', 'RIGHT_DEFENSIVE_MIDFIELDER'],
  LEFT_DEFENSIVE_MIDFIELDER:     ['CENTRAL_DEFENSIVE_MIDFIELDER'],
  RIGHT_DEFENSIVE_MIDFIELDER:    ['CENTRAL_DEFENSIVE_MIDFIELDER'],
  CENTRAL_ATTACK_MIDFIELDER:     ['LEFT_ATTACK_MIDFIELDER', 'RIGHT_ATTACK_MIDFIELDER'],
  LEFT_ATTACK_MIDFIELDER:        ['CENTRAL_ATTACK_MIDFIELDER', 'WINGER'],
  RIGHT_ATTACK_MIDFIELDER:       ['CENTRAL_ATTACK_MIDFIELDER', 'WINGER'],
  WINGER:                        ['LEFT_ATTACK_MIDFIELDER', 'RIGHT_ATTACK_MIDFIELDER'],
  STRIKER:                       ['SHADOW_STRIKER'],
  SHADOW_STRIKER:                ['STRIKER', 'CENTRAL_ATTACK_MIDFIELDER'],
}
```

---

### 우선순위 큐 함수

```ts
// 특정 슬롯에 대한 후보 선수 정렬 반환
function getCandidates(
  slotPosition: Position,
  availablePlayers: Player[],
  alreadyPlaced: Set<string>   // 이미 배치된 playerId
): Player[]
```

정렬 기준:
1. `player.position === slotPosition` → true 먼저
2. 같은 우선도 내: `VETERAN(3) > SENIOR(2) > ROOKIE(1)` 내림차순
3. fallback: `ADJACENT_POSITIONS[slotPosition]` 포함 여부 (2순위 그룹)
4. `alreadyPlaced`에 없는 선수만 포함

---

### FootballPitch

**props:**
```ts
viewMode: 'formation' | 'grid'
children: React.ReactNode   // FormationSlot들
```

**구현:**
- `relative` 컨테이너 (aspect-ratio: 2/3)
- 초록 그라디언트 배경 + 피치 라인 (CSS)
- `viewMode === 'grid'` 시: 5열×3행 반투명 그리드 오버레이 렌더링
  - 열 헤더: LC / LHS / CTR / RHS / RC
  - 행 라벨: ATT / MID / DEF

그리드 오버레이는 `position: absolute; inset: 0` 으로 피치 위에 레이어.

---

### FormationSlot

**슬롯 3가지 상태:**

| 상태 | 조건 | 시각 |
|------|------|------|
| **채워진** | `placement[slotKey] !== null` | 초록 테두리 칩, 이름 + 포지션 약어 |
| **제안** | 비어있고 큐 1순위 존재 | 점선 테두리 + 반투명, 이름 표시, 클릭 → 확정 |
| **빈 슬롯 (Void)** | 비어있고 큐 후보 없음 | 빨간 점선 테두리, "?" + 포지션 약어, 클릭 → 스카우팅 CTA |

**드래그 앤 드롭 (HTML5 기본 API):**
- `FormationSlot`: `onDragOver`, `onDrop` 구현 (슬롯 → 슬롯 교체)
- `PlayerBench` 선수 칩: `draggable`, `onDragStart` (벤치 → 슬롯)
- 슬롯 칩: `draggable`, `onDragStart` (슬롯 → 벤치 or 다른 슬롯)

**빈 슬롯 클릭 CTA:**
```ts
navigate(`/prospects?position=${slotDef.position}`)
```
`ProspectsPage`에서 `?position` 쿼리 파라미터를 읽어 position 필터 초기값 적용.

---

### PlayerBench

**우측 사이드 패널:**
- 배치되지 않은 가용 선수 목록
- `PositionZone` (GK/DEF/MID/FWD) 별 섹션으로 그룹화
- 각 선수 칩: `draggable`
- 부상 선수 / 유스 별도 섹션 (읽기 전용, 회색)으로 표시하여 현황 파악

---

## ProspectsPage 수정

현재 `position` 상태가 로컬 `useState`로만 관리됨. `useSearchParams` 추가하여 URL 쿼리 파라미터 연동:

```ts
const [searchParams] = useSearchParams()
const [position, setPosition] = useState<Position | ''>(
  (searchParams.get('position') as Position) ?? ''
)
```

`react-router-dom`의 `useSearchParams` 훅 import 추가 필요.

---

## 라우팅 & 네비게이션

- 라우트: `/squad`
- 사이드바: "팀 빌더" 메뉴 항목 추가 (감독/ADMIN/COACHING_STAFF 표시)

---

## 제약

- 배치 상태는 로컬 상태만 — 새로고침 시 초기화 (저장 기능 없음)
- `4-4-2`, `4-3-3`, `4-2-3-1`, `4-1-4-1`, `3-5-2`, `3-4-3`, `5-3-2`, `5-4-1` 8개 포메이션만 지원 (FORMATION_OPTIONS 중 일부 제외)
- 스페인 그리드 뷰에서 같은 구역에 여러 선수가 있으면 세로 스택으로 표시
- 드래그 중 외부 라이브러리 사용 없음 (HTML5 drag API)

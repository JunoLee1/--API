# Medical Dashboard KPI Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `/dashboard` 페이지에 의료 KPI 섹션(부상 현황·행정 현황·포지션 바 차트)을 추가하여 MEDICAL·MEDICAL_DIRECTOR·HEAD_COACH 역할 사용자에게 표시한다.

**Architecture:** BE는 `dashboard.repo.ts`에 `getMedicalDashboardStats()`를 추가하고, service에서 해당 3개 역할에 한해 기존 stats와 `Promise.all`로 병렬 호출 후 `medicalDashboard` 키로 병합 반환한다. FE는 `MedicalSection.tsx` 컴포넌트를 신규 생성하고, `dashboardConfig.ts`의 `showMedicalSection` 플래그를 보고 `DashboardPage.tsx`에서 조건부 렌더링한다.

**Tech Stack:** Hono/Express + Prisma (BE), React + TypeScript + Tailwind + shadcn/ui (FE), Jest (BE 테스트)

---

## File Map

| 경로 | 변경 유형 | 역할 |
|------|-----------|------|
| `apps/api/__test__/dashboard/dashboard.service.test.ts` | Modify | `getMedicalDashboardStats` mock 추가 + 3개 역할 병합 테스트 추가 |
| `apps/api/src/dashboard/dashboard.repo.ts` | Modify | `getMedicalDashboardStats()` 메서드 추가 |
| `apps/api/src/dashboard/dashboard.service.ts` | Modify | HEAD_COACH/ASSISTANT_COACH 분리, 3개 역할에 medicalDashboard 병합 |
| `football/src/types/dashboard.ts` | Modify | `MedicalDashboardStats` 추가, 3개 인터페이스에 optional 필드 추가 |
| `football/src/pages/dashboard/dashboardConfig.ts` | Modify | `DashboardConfig`에 `showMedicalSection` 추가, 3개 역할에 `true` 설정 |
| `football/src/components/dashboard/MedicalSection.tsx` | Create | 부상 현황 + 행정 현황 + 포지션 바 차트 컴포넌트 |
| `football/src/pages/dashboard/DashboardPage.tsx` | Modify | `MedicalSection` 조건부 렌더링 추가 |

---

## Task 1: BE 서비스 테스트 업데이트 (TDD red)

**Files:**
- Modify: `apps/api/__test__/dashboard/dashboard.service.test.ts`

- [ ] **Step 1: mockRepo에 `getMedicalDashboardStats` 추가 및 3개 테스트 수정**

아래 코드로 테스트 파일 전체를 교체한다. 변경 핵심:
  - `mockRepo`에 `getMedicalDashboardStats: jest.fn()` 추가
  - MEDICAL, MEDICAL_DIRECTOR, HEAD_COACH 테스트에서 병합된 결과 검증 추가
  - ASSISTANT_COACH는 medicalDashboard 없음을 검증하는 테스트 추가

```typescript
import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DashboardService } from "../../src/dashboard/dashboard.service";

const mockMedicalDashboard = {
  currentInjuredCount: 4,
  weekNewInjuryCount: 1,
  returningIn7DaysCount: 2,
  reinjuryRiskCount: 3,
  incompleteDocCount: 1,
  pendingApprovalCount: 5,
  avgRecoveryDays: 21,
  injuriesByPosition: { GK: 0, DF: 2, MF: 1, FW: 1 },
};

const mockRepo = {
  getAdminStats: jest.fn(),
  getGmStats: jest.fn(),
  getTdStats: jest.fn(),
  getContractManagerStats: jest.fn(),
  getScoutStats: jest.fn(),
  getEquipmentManagerStats: jest.fn(),
  getTacticalAnalystStats: jest.fn(),
  getHeadCoachStats: jest.fn(),
  getSpecialistCoachStats: jest.fn(),
  getPhysicalCoachStats: jest.fn(),
  getMedicalStats: jest.fn(),
  getMedicalDirectorStats: jest.fn(),
  getMedicalDashboardStats: jest.fn(),
  getPlayerStats: jest.fn(),
  getAgentStats: jest.fn(),
} as any;

const service = new DashboardService(mockRepo);

describe("DashboardService.getStats", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ADMIN → getAdminStats 호출", async () => {
    mockRepo.getAdminStats.mockResolvedValue({ activePlayerCount: 30 });
    const result = await service.getStats({ id: 1, role: "ADMIN", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getAdminStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ activePlayerCount: 30 });
  });

  test("FRONT_OFFICE + GM → getGmStats 호출", async () => {
    mockRepo.getGmStats.mockResolvedValue({ expiringContractCount: 2 });
    const result = await service.getStats({ id: 2, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "GM" });
    expect(mockRepo.getGmStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ expiringContractCount: 2 });
  });

  test("FRONT_OFFICE + TD → getTdStats 호출", async () => {
    mockRepo.getTdStats.mockResolvedValue({ prospectCount: 5 });
    await service.getStats({ id: 3, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TD" });
    expect(mockRepo.getTdStats).toHaveBeenCalledTimes(1);
  });

  test("FRONT_OFFICE + CONTRACT_MANAGER → getContractManagerStats 호출", async () => {
    mockRepo.getContractManagerStats.mockResolvedValue({ expiringContractCount: 1 });
    await service.getStats({ id: 4, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "CONTRACT_MANAGER" });
    expect(mockRepo.getContractManagerStats).toHaveBeenCalledTimes(1);
  });

  test("FRONT_OFFICE + SCOUT → getScoutStats 호출", async () => {
    mockRepo.getScoutStats.mockResolvedValue({ prospectCount: 10 });
    await service.getStats({ id: 5, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "SCOUT" });
    expect(mockRepo.getScoutStats).toHaveBeenCalledTimes(1);
  });

  test("FRONT_OFFICE + EQUIPMENT_MANAGER → getEquipmentManagerStats 호출", async () => {
    mockRepo.getEquipmentManagerStats.mockResolvedValue({ lowStockEquipmentCount: 3 });
    const result = await service.getStats({ id: 6, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "EQUIPMENT_MANAGER" });
    expect(mockRepo.getEquipmentManagerStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ lowStockEquipmentCount: 3 });
  });

  test("FRONT_OFFICE + TACTICAL_ANALYST → getTacticalAnalystStats(userId) 호출", async () => {
    mockRepo.getTacticalAnalystStats.mockResolvedValue({ myDraftAnalysisCount: 2 });
    await service.getStats({ id: 7, role: "FRONT_OFFICE", coachingRole: null, frontOfficeRole: "TACTICAL_ANALYST" });
    expect(mockRepo.getTacticalAnalystStats).toHaveBeenCalledWith(7);
  });

  test("COACHING_STAFF + HEAD_COACH → getHeadCoachStats + getMedicalDashboardStats 병합 반환", async () => {
    mockRepo.getHeadCoachStats.mockResolvedValue({ injuredPlayerCount: 2, thisMonthSessionCount: 5, attendanceWarningPlayerCount: 1 });
    mockRepo.getMedicalDashboardStats.mockResolvedValue(mockMedicalDashboard);
    const result = await service.getStats({ id: 8, role: "COACHING_STAFF", coachingRole: "HEAD_COACH", frontOfficeRole: null });
    expect(mockRepo.getHeadCoachStats).toHaveBeenCalledTimes(1);
    expect(mockRepo.getMedicalDashboardStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ injuredPlayerCount: 2, thisMonthSessionCount: 5, attendanceWarningPlayerCount: 1, medicalDashboard: mockMedicalDashboard });
  });

  test("COACHING_STAFF + ASSISTANT_COACH → getHeadCoachStats만 호출 (medicalDashboard 없음)", async () => {
    mockRepo.getHeadCoachStats.mockResolvedValue({ injuredPlayerCount: 2, thisMonthSessionCount: 5, attendanceWarningPlayerCount: 1 });
    const result = await service.getStats({ id: 9, role: "COACHING_STAFF", coachingRole: "ASSISTANT_COACH", frontOfficeRole: null });
    expect(mockRepo.getHeadCoachStats).toHaveBeenCalledTimes(1);
    expect(mockRepo.getMedicalDashboardStats).not.toHaveBeenCalled();
    expect((result as any).medicalDashboard).toBeUndefined();
  });

  test("COACHING_STAFF + DEFENSIVE_COACH → getSpecialistCoachStats(coachingRole, userId) 호출", async () => {
    mockRepo.getSpecialistCoachStats.mockResolvedValue({ assignedPlayerCount: 8 });
    await service.getStats({ id: 10, role: "COACHING_STAFF", coachingRole: "DEFENSIVE_COACH", frontOfficeRole: null });
    expect(mockRepo.getSpecialistCoachStats).toHaveBeenCalledWith("DEFENSIVE_COACH", 10);
  });

  test("COACHING_STAFF + PHYSICAL_COACH → getPhysicalCoachStats(userId) 호출", async () => {
    mockRepo.getPhysicalCoachStats.mockResolvedValue({ assignedPlayerCount: 25 });
    await service.getStats({ id: 11, role: "COACHING_STAFF", coachingRole: "PHYSICAL_COACH", frontOfficeRole: null });
    expect(mockRepo.getPhysicalCoachStats).toHaveBeenCalledWith(11);
  });

  test("COACHING_STAFF + MEDICAL → getMedicalStats(userId) + getMedicalDashboardStats 병합 반환", async () => {
    mockRepo.getMedicalStats.mockResolvedValue({ myActiveInjuryCaseCount: 3, thisMonthReturnReadyCount: 1 });
    mockRepo.getMedicalDashboardStats.mockResolvedValue(mockMedicalDashboard);
    const result = await service.getStats({ id: 12, role: "COACHING_STAFF", coachingRole: "MEDICAL", frontOfficeRole: null });
    expect(mockRepo.getMedicalStats).toHaveBeenCalledWith(12);
    expect(mockRepo.getMedicalDashboardStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ myActiveInjuryCaseCount: 3, thisMonthReturnReadyCount: 1, medicalDashboard: mockMedicalDashboard });
  });

  test("COACHING_STAFF + MEDICAL_DIRECTOR → getMedicalDirectorStats(userId) + getMedicalDashboardStats 병합 반환", async () => {
    mockRepo.getMedicalDirectorStats.mockResolvedValue({ myActiveInjuryCaseCount: 2, thisMonthReturnReadyCount: 0, totalInjuredPlayerCount: 5 });
    mockRepo.getMedicalDashboardStats.mockResolvedValue(mockMedicalDashboard);
    const result = await service.getStats({ id: 13, role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR", frontOfficeRole: null });
    expect(mockRepo.getMedicalDirectorStats).toHaveBeenCalledWith(13);
    expect(mockRepo.getMedicalDashboardStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ myActiveInjuryCaseCount: 2, thisMonthReturnReadyCount: 0, totalInjuredPlayerCount: 5, medicalDashboard: mockMedicalDashboard });
  });

  test("PLAYER → getPlayerStats(userId) 호출", async () => {
    mockRepo.getPlayerStats.mockResolvedValue({ thisSeasonMatchCount: 10 });
    await service.getStats({ id: 14, role: "PLAYER", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getPlayerStats).toHaveBeenCalledWith(14);
  });

  test("AGENT → getAgentStats(userId) 호출", async () => {
    mockRepo.getAgentStats.mockResolvedValue({ managedPlayerCount: 3 });
    await service.getStats({ id: 15, role: "AGENT", coachingRole: null, frontOfficeRole: null });
    expect(mockRepo.getAgentStats).toHaveBeenCalledWith(15);
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd /Users/juno/work/football && npx jest __test__/dashboard/dashboard.service.test.ts --no-coverage
```

Expected: HEAD_COACH, MEDICAL, MEDICAL_DIRECTOR 테스트 3개 FAIL (getMedicalDashboardStats is not a function 또는 result에 medicalDashboard 없음)

---

## Task 2: BE Repo — `getMedicalDashboardStats()` 추가

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.repo.ts`

- [ ] **Step 1: repo.ts에 날짜 헬퍼 + 메서드 추가**

파일 상단 헬퍼 블록 끝부분(현재 `START_OF_MONTH` 함수 바로 뒤)에 아래를 추가한다:

```typescript
const START_OF_WEEK = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // 월요일 기준
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};
```

그리고 `DashboardRepository` 클래스 마지막 메서드(`getAgentStats`) 뒤에 아래 메서드 추가:

```typescript
async getMedicalDashboardStats() {
  const now = NOW();
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const startOfWeek = START_OF_WEEK();

  const [
    currentInjuredPlayers,
    weekNewInjuryCount,
    returningIn7DaysPlayers,
    reinjuryRiskGroups,
    incompleteDocCount,
    pendingApprovalCount,
    avgRecoveryRaw,
    injuryGroups,
  ] = await Promise.all([
    this.prisma.injury.findMany({
      where: { status: { notIn: ["RETURNED"] } },
      select: { playerId: true },
      distinct: ["playerId"],
    }),
    this.prisma.injury.count({
      where: { occurredAt: { gte: startOfWeek } },
    }),
    this.prisma.injury.findMany({
      where: {
        status: { notIn: ["RETURNED"] },
        expectedReturnDate: { gte: now, lte: in7Days },
      },
      select: { playerId: true },
      distinct: ["playerId"],
    }),
    this.prisma.injury.groupBy({
      by: ["playerId"],
      _count: { playerId: true },
      having: { playerId: { _count: { gte: 2 } } },
    }),
    this.prisma.medicalExpense.count({
      where: { OR: [{ fileUrl: null }, { status: "DRAFT" }] },
    }),
    this.prisma.medicalExpense.count({
      where: { status: { in: ["SUBMITTED", "LEADER_APPROVED"] } },
    }),
    this.prisma.$queryRaw<{ avg_days: number | null }[]>`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("updatedAt" - "occurredAt")) / 86400))::int AS avg_days
      FROM "Injury"
      WHERE status = 'RETURNED'
    `,
    this.prisma.injury.groupBy({
      by: ["playerId"],
      _count: { id: true },
    }),
  ]);

  const playerIds = injuryGroups.map((g) => g.playerId);
  const players = await this.prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, position: true },
  });
  const posMap = new Map(players.map((p) => [p.id, p.position]));

  const GK_POSITIONS = ["GOALKEEPER"];
  const DF_POSITIONS = ["CENTER_BACK", "LEFT_WING_BACK", "RIGHT_WING_BACK", "LEFT_FULL_BACK", "RIGHT_FULL_BACK"];
  const MF_POSITIONS = ["DEFENSIVE_MIDFIELDER", "CENTRAL_MIDFIELDER", "WIDE_MIDFIELDER", "ATTACKING_MIDFIELDER", "CENTRAL_ATTACK_MIDFIELDER", "RIGHT_ATTACK_MIDFIELDER", "LEFT_ATTACK_MIDFIELDER"];
  const FW_POSITIONS = ["STRIKER", "SHADOW_STRIKER", "WINGER"];

  const injuriesByPosition = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const g of injuryGroups) {
    const pos = posMap.get(g.playerId);
    if (!pos) continue;
    if (GK_POSITIONS.includes(pos)) injuriesByPosition.GK += g._count.id;
    else if (DF_POSITIONS.includes(pos)) injuriesByPosition.DF += g._count.id;
    else if (MF_POSITIONS.includes(pos)) injuriesByPosition.MF += g._count.id;
    else if (FW_POSITIONS.includes(pos)) injuriesByPosition.FW += g._count.id;
  }

  return {
    currentInjuredCount: currentInjuredPlayers.length,
    weekNewInjuryCount,
    returningIn7DaysCount: returningIn7DaysPlayers.length,
    reinjuryRiskCount: reinjuryRiskGroups.length,
    incompleteDocCount,
    pendingApprovalCount,
    avgRecoveryDays: avgRecoveryRaw[0]?.avg_days ?? null,
    injuriesByPosition,
  };
}
```

---

## Task 3: BE Service — medicalDashboard 병합 (TDD green)

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.service.ts`

- [ ] **Step 1: `getCoachingStats` 메서드 업데이트**

`getCoachingStats` 메서드 전체를 아래 코드로 교체한다 (HEAD_COACH/ASSISTANT_COACH 분리, 3개 역할에 Promise.all 병합):

```typescript
private async getCoachingStats(user: UserCtx) {
  switch (user.coachingRole) {
    case "HEAD_COACH": {
      const [roleStats, medicalDashboard] = await Promise.all([
        this.repo.getHeadCoachStats(),
        this.repo.getMedicalDashboardStats(),
      ]);
      return { ...roleStats, medicalDashboard };
    }
    case "ASSISTANT_COACH":
      return this.repo.getHeadCoachStats();
    case "PHYSICAL_COACH":
      return this.repo.getPhysicalCoachStats(user.id);
    case "MEDICAL": {
      const [roleStats, medicalDashboard] = await Promise.all([
        this.repo.getMedicalStats(user.id),
        this.repo.getMedicalDashboardStats(),
      ]);
      return { ...roleStats, medicalDashboard };
    }
    case "MEDICAL_DIRECTOR": {
      const [roleStats, medicalDashboard] = await Promise.all([
        this.repo.getMedicalDirectorStats(user.id),
        this.repo.getMedicalDashboardStats(),
      ]);
      return { ...roleStats, medicalDashboard };
    }
    default:
      if (!user.coachingRole) throw new Error(`Missing coachingRole for COACHING_STAFF user ${user.id}`);
      return this.repo.getSpecialistCoachStats(user.coachingRole, user.id);
  }
}
```

주의: `getStats` 메서드의 `case "COACHING_STAFF":` 분기에서 `getCoachingStats(user)`를 `await`로 호출하고 있는지 확인한다. 현재 코드는 `return this.getCoachingStats(user)` — Promise를 그대로 반환하므로 변경 불필요.

- [ ] **Step 2: 테스트 실행 → PASS 확인**

```bash
cd /Users/juno/work/football && npx jest __test__/dashboard/dashboard.service.test.ts --no-coverage
```

Expected: 전체 17개 테스트 PASS

- [ ] **Step 3: 커밋**

```bash
cd /Users/juno/work/football && git add apps/api/__test__/dashboard/dashboard.service.test.ts apps/api/src/dashboard/dashboard.repo.ts apps/api/src/dashboard/dashboard.service.ts && git commit -m "feat(dashboard): add getMedicalDashboardStats and merge into medical roles"
```

---

## Task 4: FE Types — MedicalDashboardStats 추가

**Files:**
- Modify: `football/src/types/dashboard.ts`

- [ ] **Step 1: `MedicalDashboardStats` 인터페이스 추가 및 3개 타입 확장**

파일 전체를 아래 코드로 교체한다:

```typescript
export interface AdminStats {
  activePlayerCount: number
  expiringContractCount: number
  injuredPlayerCount: number
  lowStockEquipmentCount: number
}

export interface GmStats {
  expiringContractCount: number
  injuredPlayerCount: number
  activeTransferCount: number
}

export interface TdStats {
  activeTransferCount: number
  prospectCount: number
  injuredPlayerCount: number
}

export interface ContractManagerStats {
  expiringContractCount: number
  totalActiveContractCount: number
}

export interface ScoutStats {
  prospectCount: number
  thisMonthProspectCount: number
}

export interface EquipmentManagerStats {
  lowStockEquipmentCount: number
  totalEquipmentItemCount: number
}

export interface TacticalAnalystStats {
  myDraftAnalysisCount: number
  thisMonthMatchCount: number
}

export interface MedicalDashboardStats {
  currentInjuredCount: number
  weekNewInjuryCount: number
  returningIn7DaysCount: number
  reinjuryRiskCount: number
  incompleteDocCount: number
  pendingApprovalCount: number
  avgRecoveryDays: number | null
  injuriesByPosition: { GK: number; DF: number; MF: number; FW: number }
}

export interface HeadCoachStats {
  injuredPlayerCount: number
  thisMonthSessionCount: number
  attendanceWarningPlayerCount: number
  medicalDashboard?: MedicalDashboardStats
}

export interface SpecialistCoachStats {
  assignedPlayerCount: number
  myThisMonthSessionCount: number
}

export interface MedicalStats {
  myActiveInjuryCaseCount: number
  thisMonthReturnReadyCount: number
  medicalDashboard?: MedicalDashboardStats
}

export interface MedicalDirectorStats extends MedicalStats {
  totalInjuredPlayerCount: number
}

export interface PlayerStats {
  thisSeasonMatchCount: number
  thisMonthAttendanceRate: number
}

export interface AgentStats {
  managedPlayerCount: number
  injuredManagedPlayerCount: number
  expiringManagedContractCount: number
}

export type DashboardStats =
  | AdminStats
  | GmStats
  | TdStats
  | ContractManagerStats
  | ScoutStats
  | EquipmentManagerStats
  | TacticalAnalystStats
  | HeadCoachStats
  | SpecialistCoachStats
  | MedicalStats
  | MedicalDirectorStats
  | PlayerStats
  | AgentStats
```

---

## Task 5: FE Config — showMedicalSection 플래그 추가

**Files:**
- Modify: `football/src/pages/dashboard/dashboardConfig.ts`

- [ ] **Step 1: `DashboardConfig` 인터페이스에 `showMedicalSection` 추가**

```typescript
// 기존 DashboardConfig 인터페이스 교체
export interface DashboardConfig {
  statCards: StatCardConfig[]
  showActionQueue: boolean
  showSchedule: boolean
  recentFeedTitle?: string
  showMedicalSection: boolean
}
```

- [ ] **Step 2: `getDashboardConfig` 내 모든 return 객체에 `showMedicalSection` 추가**

MEDICAL_DIRECTOR 분기 (`coachingRole === 'MEDICAL_DIRECTOR'`) 반환값:
```typescript
return {
  statCards: [
    { label: '내 담당 부상 케이스', getValue: (s) => (s as MedicalDirectorStats).myActiveInjuryCaseCount, unit: '건' },
    { label: '이번 달 복귀 가능 전환', getValue: (s) => (s as MedicalDirectorStats).thisMonthReturnReadyCount, unit: '건' },
    { label: '전체 부상 선수', getValue: (s) => (s as MedicalDirectorStats).totalInjuredPlayerCount, unit: '명', highlight: true },
  ],
  showActionQueue: true,
  showSchedule: false,
  recentFeedTitle: '최근 부상 업데이트',
  showMedicalSection: true,
}
```

MEDICAL 분기 (`coachingRole === 'MEDICAL'`) 반환값:
```typescript
return {
  statCards: [
    { label: '내 담당 부상 케이스', getValue: (s) => (s as MedicalStats).myActiveInjuryCaseCount, unit: '건' },
    { label: '이번 달 복귀 가능 전환', getValue: (s) => (s as MedicalStats).thisMonthReturnReadyCount, unit: '건' },
  ],
  showActionQueue: true,
  showSchedule: false,
  recentFeedTitle: '최근 부상 업데이트',
  showMedicalSection: true,
}
```

HEAD_COACH 분기 (`coachingRole === 'HEAD_COACH' || coachingRole === 'ASSISTANT_COACH'`) — HEAD_COACH와 ASSISTANT_COACH를 분리한다:

```typescript
if (coachingRole === 'HEAD_COACH') {
  return {
    statCards: [
      { label: '부상 선수', getValue: (s) => (s as HeadCoachStats).injuredPlayerCount, unit: '명', highlight: true },
      { label: '이번 달 훈련 세션', getValue: (s) => (s as HeadCoachStats).thisMonthSessionCount, unit: '회' },
      { label: '출석 경고 선수', getValue: (s) => (s as HeadCoachStats).attendanceWarningPlayerCount, unit: '명', highlight: true },
    ],
    showActionQueue: true,
    showSchedule: true,
    recentFeedTitle: '최근 경기 결과',
    showMedicalSection: true,
  }
}
if (coachingRole === 'ASSISTANT_COACH') {
  return {
    statCards: [
      { label: '부상 선수', getValue: (s) => (s as HeadCoachStats).injuredPlayerCount, unit: '명', highlight: true },
      { label: '이번 달 훈련 세션', getValue: (s) => (s as HeadCoachStats).thisMonthSessionCount, unit: '회' },
      { label: '출석 경고 선수', getValue: (s) => (s as HeadCoachStats).attendanceWarningPlayerCount, unit: '명', highlight: true },
    ],
    showActionQueue: true,
    showSchedule: true,
    recentFeedTitle: '최근 경기 결과',
    showMedicalSection: false,
  }
}
```

나머지 모든 `return` 객체에 `showMedicalSection: false` 추가 (ADMIN, GM, TD, CONTRACT_MANAGER, SCOUT, EQUIPMENT_MANAGER, TACTICAL_ANALYST, PHYSICAL, specialist, PLAYER, AGENT).

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -30
```

Expected: 에러 없음 (또는 `showMedicalSection` 관련 에러만 → Task 4,5로 해결됨)

---

## Task 6: FE — MedicalSection 컴포넌트 생성

**Files:**
- Create: `football/src/components/dashboard/MedicalSection.tsx`

- [ ] **Step 1: 컴포넌트 파일 생성**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MedicalDashboardStats } from '@/types/dashboard'

interface Props {
  data: MedicalDashboardStats
  role: string | null | undefined
}

function KpiCard({
  label,
  value,
  unit,
  color = 'default',
}: {
  label: string
  value: number | string
  unit?: string
  color?: 'default' | 'red' | 'amber' | 'green' | 'blue'
}) {
  const valueClass =
    color === 'red' ? 'text-destructive' :
    color === 'amber' ? 'text-amber-500' :
    color === 'green' ? 'text-green-600' :
    color === 'blue' ? 'text-blue-600' :
    ''
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${valueClass}`}>
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  )
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-sm text-right shrink-0 font-medium">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-sm text-right tabular-nums shrink-0">{count}</span>
    </div>
  )
}

export function MedicalSection({ data, role }: Props) {
  const isHeadCoach = role === 'HEAD_COACH'
  const pos = data.injuriesByPosition
  const maxPos = Math.max(pos.GK, pos.DF, pos.MF, pos.FW, 1)
  const posEntries = ([
    ['GK', pos.GK],
    ['DF', pos.DF],
    ['MF', pos.MF],
    ['FW', pos.FW],
  ] as [string, number][]).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-6">
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          의료 현황
        </h3>

        {/* 부상 현황 */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-medium text-muted-foreground">부상 현황</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <KpiCard label="현재 부상자" value={data.currentInjuredCount} unit="명" color="red" />
            <KpiCard label="금주 신규 부상" value={data.weekNewInjuryCount} unit="건" color="amber" />
            <KpiCard label="7일 내 복귀 예정" value={data.returningIn7DaysCount} unit="명" color="green" />
            {!isHeadCoach && (
              <KpiCard label="재부상 위험군" value={data.reinjuryRiskCount} unit="명" color="amber" />
            )}
          </div>
        </div>

        {/* 행정 현황 */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-medium text-muted-foreground">행정 현황</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {!isHeadCoach && (
              <KpiCard label="서류 미비" value={data.incompleteDocCount} unit="건" color="amber" />
            )}
            <KpiCard label="승인 대기" value={data.pendingApprovalCount} unit="건" color="amber" />
            {!isHeadCoach && (
              <KpiCard
                label="평균 복귀 소요일"
                value={data.avgRecoveryDays != null ? data.avgRecoveryDays : '—'}
                unit={data.avgRecoveryDays != null ? '일' : undefined}
                color="blue"
              />
            )}
          </div>
        </div>

        {/* 포지션별 부상 추이 */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">포지션별 부상 추이 (전체 이력)</p>
          <div className="space-y-2 max-w-sm">
            {posEntries.map(([label, count]) => (
              <BarRow key={label} label={label} count={count} max={maxPos} />
            ))}
            {posEntries.every(([, count]) => count === 0) && (
              <p className="text-sm text-muted-foreground">부상 데이터가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 7: FE — DashboardPage에 MedicalSection 통합

**Files:**
- Modify: `football/src/pages/dashboard/DashboardPage.tsx`

- [ ] **Step 1: import 추가 및 조건부 렌더링 추가**

파일 상단 import 블록에 추가:
```typescript
import { MedicalSection } from '@/components/dashboard/MedicalSection'
import type { HeadCoachStats } from '@/types/dashboard'
```

기존 `</div>` (stat 카드 grid 닫는 태그) 바로 뒤, 기존 카드 그룹 `<div className="grid ...">` 앞에 추가:

```tsx
{config.showMedicalSection && stats && (stats as HeadCoachStats).medicalDashboard && (
  <MedicalSection
    data={(stats as HeadCoachStats).medicalDashboard!}
    role={user.coachingRole}
  />
)}
```

최종 `DashboardPage.tsx` 반환부는 아래와 같은 구조가 된다:

```tsx
return (
  <div className="p-8 space-y-6">
    <div>
      <h2 className="text-2xl font-semibold mb-1">대시보드</h2>
      <p className="text-muted-foreground text-sm">{user.nickname}님, 안녕하세요</p>
    </div>

    {/* 숫자 카드 */}
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {config.statCards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={stats ? card.getValue(stats) : '—'}
          unit={card.unit}
          highlight={card.highlight && stats ? (card.getValue(stats) as number) > 0 : false}
        />
      ))}
    </div>

    {/* 의료 KPI 섹션 */}
    {config.showMedicalSection && stats && (stats as HeadCoachStats).medicalDashboard && (
      <MedicalSection
        data={(stats as HeadCoachStats).medicalDashboard!}
        role={user.coachingRole}
      />
    )}

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {config.showActionQueue && (
        <ActionQueueCard notifications={notifications} loading={notiLoading} />
      )}
      {config.recentFeedTitle && (
        <RecentFeedCard
          title={config.recentFeedTitle}
          items={[]}
          loading={false}
        />
      )}
      {config.showSchedule && (
        <ScheduleCard items={[]} loading={false} />
      )}
    </div>
  </div>
)
```

- [ ] **Step 2: TypeScript 최종 확인**

```bash
cd /Users/juno/work/football/football && npx tsc --noEmit 2>&1 | head -30
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd /Users/juno/work/football && git add football/src/types/dashboard.ts football/src/pages/dashboard/dashboardConfig.ts football/src/components/dashboard/MedicalSection.tsx football/src/pages/dashboard/DashboardPage.tsx && git commit -m "feat(dashboard): add MedicalSection KPI for MEDICAL, MEDICAL_DIRECTOR, HEAD_COACH"
```

---

## 수동 검증

FE 개발 서버를 띄운 뒤 아래 시나리오를 확인한다:

| 계정 역할 | 기대 UI |
|-----------|---------|
| MEDICAL | 의료 KPI 섹션 표시 — 부상 현황 4개 + 행정 현황 3개 + 포지션 차트 |
| MEDICAL_DIRECTOR | 동일 |
| HEAD_COACH | 부상 현황 3개(재부상 위험군 없음) + 승인 대기 1개 + 포지션 차트 |
| ASSISTANT_COACH | 의료 KPI 섹션 미표시 |
| 기타 역할 | 의료 KPI 섹션 미표시 |

엣지 케이스:
- 부상자 0명 → 숫자 카드 전부 0 표시
- RETURNED 부상만 있고 avgRecoveryDays 없음 → `—` 표시
- 포지션 데이터 없음 → "부상 데이터가 없습니다." 표시

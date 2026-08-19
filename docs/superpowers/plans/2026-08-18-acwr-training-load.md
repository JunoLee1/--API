# ACWR Training Load Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 훈련 부하 ACWR(급성:만성 훈련부하비) 계산의 두 가지 버그(E1: 제수 고정, E2: 취소 세션 포함)를 수정하고, 이미 존재하는 백엔드 엔드포인트를 프론트엔드 StatsTab에 연결한다.

**Architecture:** E2(취소 세션 필터)를 repo 레이어에서 먼저 수정하여 downstream 모든 쿼리를 정확하게 만든 뒤, E1(제수 수정+가드)을 service 레이어에서 순수 로직으로 수정한다. E4(프론트엔드)는 기존 `/training-loads/acute-chronic/:playerId` 엔드포인트를 호출하는 API 메서드를 추가하고 StatsTab에 카드를 삽입한다.

**Tech Stack:** Node.js · Express · Prisma (PostgreSQL) · TypeScript · Jest (ts-jest) · React · Vite

---

## File Map

| 파일 | 변경 내용 |
|---|---|
| `apps/api/src/training-load/training-load.repo.ts` | E2: `getWeeklyLoadTotal`, `getInjuryLoadCorrelation`, `getLoadsBetween` 세 메서드에 `cancelledAt: null` 추가; `getLoadsBetween`에 `session.date` 반환 추가 |
| `apps/api/src/training-load/training-load.service.ts` | E1: `getAcuteChronicRatio`에서 제수를 실제 데이터가 있는 distinct ISO 주 수(max 4)로 교체; `ratio < 0` 가드 추가; riskLevel 임계치 수정 |
| `apps/api/src/training-load/training-load.service.test.ts` | 신규 생성: E1 로직 단위 테스트 |
| `football/src/types/training-load.ts` | `AcwrResult` 타입 추가 |
| `football/src/services/training-load.service.ts` | `acwr(playerId)` 메서드 추가 |
| `football/src/pages/players/tabs/StatsTab.tsx` | ACWR 카드 섹션 추가 |

---

## Task 1: E2 — 취소된 세션 필터

**Files:**
- Modify: `apps/api/src/training-load/training-load.repo.ts:52-65` (`getWeeklyLoadTotal`)
- Modify: `apps/api/src/training-load/training-load.repo.ts:86-90` (`getInjuryLoadCorrelation`)
- Modify: `apps/api/src/training-load/training-load.repo.ts:141-146` (`getLoadsBetween`)

`TrainingSession.cancelledAt` 필드가 `null`인 세션만 집계해야 한다. 현재 세 메서드 모두 `session: { date: ... }` 조건만 있어 취소 세션도 포함된다.

- [x] **Step 1: `getWeeklyLoadTotal` 수정**

  `apps/api/src/training-load/training-load.repo.ts` 56~62행을 아래로 교체한다.

  ```typescript
  const rows = await this.prisma.trainingLoad.findMany({
    where: {
      playerId,
      load: { not: null },
      session: { date: { gte: weekStart, lt: weekEnd }, cancelledAt: null },
    },
    select: { load: true },
  });
  ```

- [x] **Step 2: `getInjuryLoadCorrelation` 수정**

  86~90행의 `allLoads` 쿼리를 아래로 교체한다.

  ```typescript
  const allLoads = await this.prisma.trainingLoad.findMany({
    where: { playerId, session: { date: { gte: earliest, lte: latest }, cancelledAt: null } },
    include: { session: { select: { date: true, sessionType: true } } },
    orderBy: { session: { date: "asc" } },
  });
  ```

- [x] **Step 3: `getLoadsBetween` 수정**

  141~146행을 아래로 교체한다. `session.date`를 함께 반환해야 E1(Task 2)에서 distinct 주 수를 계산할 수 있다.

  ```typescript
  getLoadsBetween(playerId: string, from: Date, to: Date) {
    return this.prisma.trainingLoad.findMany({
      where: { playerId, session: { date: { gte: from, lt: to }, cancelledAt: null } },
      select: { load: true, rpe: true, session: { select: { date: true } } },
    });
  }
  ```

- [x] **Step 4: 빌드 확인**

  ```bash
  cd apps/api && npm run build 2>&1 | tail -20
  ```

  Expected: 에러 없이 종료. 타입 오류가 있다면 서비스에서 `l.session.date`를 사용하지 않는 acuteLoads 처리 부분을 확인한다(Task 2에서 수정 예정이므로 지금은 TS 오류 발생 가능 — Task 2에서 함께 해결).

- [x] **Step 5: 커밋**

  ```bash
  git add apps/api/src/training-load/training-load.repo.ts
  git commit -m "fix(training-load): exclude cancelled sessions from load queries (E2)"
  ```

---

## Task 2: E1 — ACWR 제수 수정 + 가드 추가

**Files:**
- Modify: `apps/api/src/training-load/training-load.service.ts:153-174` (`getAcuteChronicRatio`)
- Create: `apps/api/src/training-load/training-load.service.test.ts`

현재 `chronicWeeklyAvg = total / 4`로 하드코딩되어 있다. 28일 창 안에 데이터가 있는 실제 distinct ISO 주 수(max 4)로 나눠야 한다. 또한 `ratio < 0`이면 데이터 오염이므로 500 에러를 던진다.

- [x] **Step 1: 테스트 파일 작성 (실패 확인용)**

  `apps/api/src/training-load/training-load.service.test.ts` 파일을 새로 만든다.

  ```typescript
  import { TrainingLoadService } from "./training-load.service";
  import type { TrainingLoadRepository } from "./training-load.repo";

  const makeRepo = (overrides: Partial<TrainingLoadRepository> = {}): TrainingLoadRepository =>
    ({
      getLoadsBetween: jest.fn().mockResolvedValue([]),
      findAll: jest.fn(),
      upsert: jest.fn(),
      getWeeklyLoadTotal: jest.fn().mockResolvedValue(0),
      getPlayerName: jest.fn().mockResolvedValue(null),
      getInjuryLoadCorrelation: jest.fn().mockResolvedValue([]),
      getPlayerGrowthTrajectory: jest.fn().mockResolvedValue({ playerId: "", trajectory: [], dataPoints: 0 }),
      getAllWithSession: jest.fn().mockResolvedValue([]),
      findActiveInjury: jest.fn().mockResolvedValue(null),
      ...overrides,
    } as unknown as TrainingLoadRepository);

  const makeSvc = (overrides: Partial<TrainingLoadRepository> = {}) =>
    new TrainingLoadService(makeRepo(overrides), {} as any);

  // KST 기준 월요일 두 개 (서로 다른 ISO 주)
  const week1Mon = new Date("2026-08-03T00:00:00Z");
  const week2Mon = new Date("2026-08-10T00:00:00Z");

  describe("TrainingLoadService.getAcuteChronicRatio", () => {
    it("2주 데이터 → chronicWeeklyAvg = total / 2 (not /4)", async () => {
      const svc = makeSvc({
        getLoadsBetween: jest.fn()
          .mockResolvedValueOnce([]) // acute
          .mockResolvedValueOnce([
            { load: 400, rpe: 7, session: { date: week1Mon } },
            { load: 400, rpe: 7, session: { date: week2Mon } },
          ]),
      });
      const result = await svc.getAcuteChronicRatio("player-1");
      expect(result.chronicWeeklyAvg).toBe(400); // 800 / 2
    });

    it("같은 주에 여러 건 → distinct weeks = 1로 취급", async () => {
      const wednesday = new Date("2026-08-05T00:00:00Z"); // week1Mon과 같은 주
      const svc = makeSvc({
        getLoadsBetween: jest.fn()
          .mockResolvedValueOnce([]) // acute
          .mockResolvedValueOnce([
            { load: 300, rpe: 6, session: { date: week1Mon } },
            { load: 200, rpe: 6, session: { date: wednesday } },
          ]),
      });
      const result = await svc.getAcuteChronicRatio("player-1");
      expect(result.chronicWeeklyAvg).toBe(500); // 500 / 1
    });

    it("28일 데이터 없음 → ratio null, riskLevel UNKNOWN", async () => {
      const svc = makeSvc({
        getLoadsBetween: jest.fn().mockResolvedValue([]),
      });
      const result = await svc.getAcuteChronicRatio("player-1");
      expect(result.acuteChronicRatio).toBeNull();
      expect(result.riskLevel).toBe("UNKNOWN");
    });

    it("ratio < 0 → AppError 500 ACWR_CALC_ERROR", async () => {
      const svc = makeSvc({
        getLoadsBetween: jest.fn()
          .mockResolvedValueOnce([{ load: -100, rpe: 5, session: { date: week2Mon } }]) // acute 음수
          .mockResolvedValueOnce([{ load: 400, rpe: 7, session: { date: week1Mon } }]),
      });
      await expect(svc.getAcuteChronicRatio("player-1")).rejects.toMatchObject({
        statusCode: 500,
        message: "ACWR_CALC_ERROR",
      });
    });

    it("ratio = 0 → UNDERTRAINED (에러 아님)", async () => {
      const svc = makeSvc({
        getLoadsBetween: jest.fn()
          .mockResolvedValueOnce([]) // acute: 0
          .mockResolvedValueOnce([{ load: 400, rpe: 7, session: { date: week1Mon } }]),
      });
      const result = await svc.getAcuteChronicRatio("player-1");
      expect(result.acuteChronicRatio).toBe(0);
      expect(result.riskLevel).toBe("UNDERTRAINED");
    });

    it("ratio 1.08 → OPTIMAL (coupled 모델 확인)", async () => {
      // 커플드: chronic 창이 acute 주를 포함
      const svc = makeSvc({
        getLoadsBetween: jest.fn()
          .mockResolvedValueOnce([{ load: 850, rpe: 7, session: { date: week2Mon } }]) // acute
          .mockResolvedValueOnce([
            { load: 720, rpe: 7, session: { date: week1Mon } },
            { load: 850, rpe: 7, session: { date: week2Mon } }, // acute 주 포함 (coupled)
          ]),
      });
      const result = await svc.getAcuteChronicRatio("player-1");
      // chronicTotal=1570, actualWeeks=2, avg=785, ratio=850/785≈1.08
      expect(result.riskLevel).toBe("OPTIMAL");
      expect(result.acuteChronicRatio).toBe(1.08);
    });

    it("ratio > 1.3 → HIGH_RISK", async () => {
      const svc = makeSvc({
        getLoadsBetween: jest.fn()
          .mockResolvedValueOnce([{ load: 1200, rpe: 9, session: { date: week2Mon } }]) // acute
          .mockResolvedValueOnce([
            { load: 600, rpe: 6, session: { date: week1Mon } },
            { load: 1200, rpe: 9, session: { date: week2Mon } },
          ]),
      });
      const result = await svc.getAcuteChronicRatio("player-1");
      // avg=900, ratio=1200/900≈1.33 → HIGH_RISK
      expect(result.riskLevel).toBe("HIGH_RISK");
    });
  });
  ```

- [x] **Step 2: 테스트 실행 — 실패 확인**

  ```bash
  cd apps/api && npx jest training-load.service.test.ts --no-coverage 2>&1 | tail -30
  ```

  Expected: 여러 테스트 FAIL (아직 구현 전).

- [x] **Step 3: `getAcuteChronicRatio` 구현 수정**

  `apps/api/src/training-load/training-load.service.ts` 153~186행을 아래로 교체한다.

  ```typescript
  async getAcuteChronicRatio(playerId: string) {
    const now = new Date();
    const acuteStart = new Date(now); acuteStart.setDate(now.getDate() - 7);
    const chronicStart = new Date(now); chronicStart.setDate(now.getDate() - 28);

    const [acuteLoads, chronicLoads] = await Promise.all([
      this.repo.getLoadsBetween(playerId, acuteStart, now),
      this.repo.getLoadsBetween(playerId, chronicStart, now),
    ]);

    const acuteTotal = acuteLoads.reduce((s, l) => s + (l.load ?? 0), 0);

    const chronicTotal = chronicLoads.reduce((s, l) => s + (l.load ?? 0), 0);
    const distinctWeeks = new Set(chronicLoads.map((l) => this.getISOWeekKey(l.session.date))).size;
    const actualWeeks = Math.min(distinctWeeks, 4);
    const chronicWeeklyAvg = actualWeeks === 0 ? 0 : chronicTotal / actualWeeks;

    const ratio = chronicWeeklyAvg === 0 ? null : Math.round((acuteTotal / chronicWeeklyAvg) * 100) / 100;

    if (ratio !== null && ratio < 0) {
      throw new AppError(500, "ACWR_CALC_ERROR");
    }

    const riskLevel =
      ratio === null
        ? "UNKNOWN"
        : ratio < 0.8
          ? "UNDERTRAINED"
          : ratio <= 1.3
            ? "OPTIMAL"
            : "HIGH_RISK";

    return {
      playerId,
      acuteLoad: acuteTotal,
      chronicWeeklyAvg: Math.round(chronicWeeklyAvg),
      acuteChronicRatio: ratio,
      riskLevel,
    };
  }

  private getISOWeekKey(date: Date): string {
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const kst = new Date(date.getTime() + KST_OFFSET_MS);
    const day = kst.getUTCDay() || 7; // 1=Mon…7=Sun
    kst.setUTCDate(kst.getUTCDate() - (day - 1)); // move to Monday
    return kst.toISOString().slice(0, 10);
  }

  private getWeekStart(date: Date): Date {
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const kstTime = new Date(date.getTime() + KST_OFFSET_MS);
    const day = kstTime.getUTCDay();
    const diff = kstTime.getUTCDate() - day + (day === 0 ? -6 : 1);
    kstTime.setUTCDate(diff);
    kstTime.setUTCHours(0, 0, 0, 0);
    return new Date(kstTime.getTime() - KST_OFFSET_MS);
  }
  ```

  > 기존 `getWeekStart` 메서드는 그대로 유지한다. `getISOWeekKey`를 새로 추가하는 것.

- [x] **Step 4: 테스트 실행 — 통과 확인**

  ```bash
  cd apps/api && npx jest training-load.service.test.ts --no-coverage 2>&1 | tail -30
  ```

  Expected: 7개 테스트 모두 PASS.

- [x] **Step 5: 전체 테스트 확인**

  ```bash
  cd apps/api && npm test -- --no-coverage 2>&1 | tail -20
  ```

  Expected: 기존 실패 테스트(training.service.test.ts, maintenance.service.test.ts — pre-existing)를 제외하고 신규 실패 없음.

- [x] **Step 6: 커밋**

  ```bash
  git add apps/api/src/training-load/training-load.service.ts \
           apps/api/src/training-load/training-load.service.test.ts
  git commit -m "fix(training-load): fix ACWR divisor to use actual data weeks; add negative guard (E1)"
  ```

---

## Task 3: E4 — 프론트엔드 ACWR 카드

**Files:**
- Modify: `football/src/types/training-load.ts`
- Modify: `football/src/services/training-load.service.ts`
- Modify: `football/src/pages/players/tabs/StatsTab.tsx`

백엔드 `/training-loads/acute-chronic/:playerId` 엔드포인트는 이미 존재한다. 프론트엔드에서 호출하지 않고 있으므로 API 메서드 추가 후 StatsTab에 카드를 삽입한다.

- [x] **Step 1: `AcwrResult` 타입 추가**

  `football/src/types/training-load.ts` 파일 끝에 추가한다.

  ```typescript
  export interface AcwrResult {
    playerId: string
    acuteLoad: number
    chronicWeeklyAvg: number
    acuteChronicRatio: number | null
    riskLevel: 'UNDERTRAINED' | 'OPTIMAL' | 'HIGH_RISK' | 'UNKNOWN'
  }
  ```

- [x] **Step 2: `acwr` API 메서드 추가**

  `football/src/services/training-load.service.ts`의 import 줄에 `AcwrResult`를 추가하고, `trainingLoadApi` 객체 끝에 메서드를 추가한다.

  ```typescript
  import type { TrainingLoad, WeeklySummary, UpsertTrainingLoadPayload, AcwrResult } from '@/types/training-load'

  export const trainingLoadApi = {
    list: (params?: { sessionId?: number; playerId?: string }) => {
      const q = new URLSearchParams()
      if (params?.sessionId) q.set('sessionId', String(params.sessionId))
      if (params?.playerId) q.set('playerId', params.playerId)
      const qs = q.toString()
      return api.get<TrainingLoad[]>(`/training-loads${qs ? `?${qs}` : ''}`)
    },
    upsert: (payload: UpsertTrainingLoadPayload) =>
      api.post<TrainingLoad>('/training-loads', payload),
    weeklySummary: (playerId: string, weekStart: string) =>
      api.get<WeeklySummary>(`/training-loads/weekly-summary?playerId=${playerId}&weekStart=${weekStart}`),
    acwr: (playerId: string) =>
      api.get<AcwrResult>(`/training-loads/acute-chronic/${playerId}`),
  }
  ```

- [x] **Step 3: StatsTab에 ACWR 상태 및 fetch 추가**

  `football/src/pages/players/tabs/StatsTab.tsx`의 import 블록에 아래를 추가한다.

  ```typescript
  import { trainingLoadApi } from '@/services/training-load.service'
  import type { AcwrResult } from '@/types/training-load'
  ```

  컴포넌트 내 기존 상태 선언 뒤에 추가한다.

  ```typescript
  const [acwr, setAcwr] = useState<AcwrResult | null>(null)
  ```

  기존 `useEffect` 안의 `Promise.all`을 아래로 교체한다. ACWR 실패 시 탭 전체가 깨지지 않도록 `.catch(() => null)`로 처리한다.

  ```typescript
  useEffect(() => {
    setLoading(true)
    Promise.all([
      playerApi.getMatchStats(playerId),
      playerApi.getTrainingResults(playerId),
      playerApi.getRadar(playerId),
      trainingLoadApi.acwr(playerId).catch(() => null),
    ])
      .then(([ms, tr, rd, acwrResult]) => {
        setMatchStats(ms)
        setTrainingResults(tr)
        setRadar(rd)
        setAcwr(acwrResult)
      })
      .finally(() => setLoading(false))
  }, [playerId])
  ```

- [x] **Step 4: ACWR 카드 섹션 렌더링 추가**

  `StatsTab.tsx` 반환부에서 Radar 섹션 바로 뒤(`<Separator />` 다음)에 아래 섹션을 삽입한다.

  ```tsx
  <Separator />

  {/* ACWR 카드 */}
  <section>
    <h3 className="text-sm font-semibold mb-3">급성:만성 훈련부하비 (ACWR)</h3>
    {acwr === null ? (
      <p className="text-sm text-muted-foreground">불러오는 중...</p>
    ) : acwr.acuteChronicRatio === null ? (
      <div className="rounded-md border px-4 py-3">
        <p className="text-sm text-muted-foreground">데이터 부족 (최근 28일 기록 없음)</p>
      </div>
    ) : (
      <div className="rounded-md border px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{acwr.acuteChronicRatio.toFixed(2)}</span>
          <Badge
            variant={acwr.riskLevel === 'OPTIMAL' ? 'default' : 'destructive'}
            className={acwr.riskLevel === 'UNDERTRAINED' ? 'bg-orange-500 hover:bg-orange-600' : undefined}
          >
            {acwr.riskLevel === 'UNDERTRAINED'
              ? '훈련 부족'
              : acwr.riskLevel === 'OPTIMAL'
                ? '정상'
                : '위험'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          급성 {acwr.acuteLoad} AU · 만성 평균 {acwr.chronicWeeklyAvg} AU/주 · 적정 0.8 – 1.3
        </p>
      </div>
    )}
  </section>
  ```

  삽입 위치: 기존 `<Separator />` (radar 섹션 뒤) 바로 다음, match stats 섹션 바로 앞.

- [x] **Step 5: TypeScript 빌드 확인**

  ```bash
  cd football && npx tsc --noEmit 2>&1 | tail -20
  ```

  Expected: 에러 없음.

- [x] **Step 6: 커밋**

  ```bash
  git add football/src/types/training-load.ts \
           football/src/services/training-load.service.ts \
           football/src/pages/players/tabs/StatsTab.tsx
  git commit -m "feat(frontend): add ACWR card to StatsTab; wire acute-chronic API (E4)"
  ```

---

## Self-Review

**Spec coverage:**
- E1 (divisor bug): Task 2에서 수정 ✅
- E2 (cancelled sessions): Task 1에서 수정 ✅
- E4 (frontend display): Task 3에서 구현 ✅
- `ratio < 0` 가드: Task 2 Step 3에 포함 ✅
- `ratio === 0` → UNDERTRAINED (에러 아님): 테스트 케이스 포함 ✅
- B+C UI (ratio + 배지 + acute/chronic 수치 + null 처리): Task 3 Step 4에 포함 ✅

**타입 일관성:**
- `AcwrResult.riskLevel` 값: 백엔드 반환 `'UNDERTRAINED' | 'OPTIMAL' | 'HIGH_RISK' | 'UNKNOWN'` ↔ 프론트 타입 정의 일치 ✅
- `getLoadsBetween` 반환 타입 변경(`session.date` 추가): Task 1 Step 3과 Task 2 Step 3에서 모두 반영 ✅

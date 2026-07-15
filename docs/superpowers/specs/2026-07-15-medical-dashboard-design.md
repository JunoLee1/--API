# 의료 대시보드 KPI 섹션 — 설계 문서

## 목표

기존 `/dashboard` 페이지에 의료 전용 KPI 섹션을 추가한다. MEDICAL · MEDICAL_DIRECTOR · HEAD_COACH 역할 사용자에게만 표시되며, 현재 부상 현황과 행정 현황을 한눈에 파악할 수 있게 한다.

## 아키텍처

기존 `/dashboard` → `getDashboardConfig()` → `StatCard` 패턴을 그대로 유지하되, 해당 역할일 때 기존 stat 카드 아래에 의료 섹션을 렌더링한다.

- BE: `dashboard.repo.ts`에 `getMedicalDashboardStats()` 메서드 추가, `dashboard.service.ts`에서 역할별 분기 호출, `dashboard.controller.ts`는 기존 `/dashboard/stats` 엔드포인트 그대로 사용
- FE: `types/dashboard.ts`에 `MedicalDashboardStats` 타입 추가, `dashboardConfig.ts`에서 해당 역할에 `medicalSection` 플래그 추가, `DashboardPage.tsx`에 `MedicalSection` 컴포넌트 조건부 렌더링

## 표시 역할

| 역할 | 부상 현황 | 행정 현황 | 포지션 차트 |
|------|-----------|-----------|-------------|
| MEDICAL | ✅ | ✅ | ✅ |
| MEDICAL_DIRECTOR | ✅ | ✅ | ✅ |
| HEAD_COACH | ✅ | ✅ (승인 대기만) | ✅ |

HEAD_COACH는 서류 미비·평균 복귀 소요일·재부상 위험군은 표시하지 않는다(의료팀 내부 행정 수치).

## KPI 상세 정의

### 부상 현황

| 항목 | 정의 | 색상 |
|------|------|------|
| 현재 부상자 | `Injury`에서 `status NOT IN ('RETURNED')` 인 고유 선수 수 | red |
| 금주 신규 부상 | `occurredAt >= 이번 주 월요일 00:00` 인 부상 건수 | amber |
| 7일 내 복귀 예정 | `expectedReturnDate BETWEEN 오늘 AND 오늘+7일` AND `status NOT IN ('RETURNED')` 인 부상의 고유 선수 수 | green |
| 재부상 위험군 | 전체 부상 이력에서 부상 건수가 2건 이상인 고유 선수 수 | amber |

### 행정 현황

| 항목 | 정의 | 색상 |
|------|------|------|
| 서류 미비 | `MedicalExpense`에서 `fileUrl IS NULL OR status = 'DRAFT'` 인 건수 | amber |
| 승인 대기 | `MedicalExpense`에서 `status IN ('SUBMITTED', 'LEADER_APPROVED')` 인 건수 (전체 합산, 역할 구분 없음) | amber |
| 평균 복귀 소요일 | `RETURNED` 상태 전환된 부상들의 `avg(updatedAt - occurredAt)` — 일 단위, 소수점 제거 | blue |

### 포지션별 부상 추이

- 전체 부상 이력(`Injury` 전체)을 `player.position` 기준으로 그룹 집계
- 포지션을 DF · MF · FW · GK 4개 그룹으로 매핑
  - GK: `GOALKEEPER`
  - DF: `CENTER_BACK`, `LEFT_WING_BACK`, `RIGHT_WING_BACK`, `LEFT_FULL_BACK`, `RIGHT_FULL_BACK`
  - MF: `DEFENSIVE_MIDFIELDER`, `CENTRAL_MIDFIELDER`, `WIDE_MIDFIELDER`, `ATTACKING_MIDFIELDER`, `CENTRAL_ATTACK_MIDFIELDER`, `RIGHT_ATTACK_MIDFIELDER`, `LEFT_ATTACK_MIDFIELDER`
  - FW: `STRIKER`, `SHADOW_STRIKER`, `WINGER`
- 가로 바 차트, 카운트 높은 순 정렬

## BE 변경 사항

### `apps/api/src/dashboard/dashboard.repo.ts`

`getMedicalDashboardStats()` 메서드 추가:

```typescript
async getMedicalDashboardStats() {
  const NOW = new Date()
  const IN_7_DAYS = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const START_OF_WEEK = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? 6 : day - 1 // 월요일 기준
    d.setDate(d.getDate() - diff)
    d.setHours(0, 0, 0, 0)
    return d
  })()

  const [
    currentInjuredCount,
    weekNewInjuryCount,
    returningIn7DaysCount,
    reinjuryRiskCount,
    incompleteDocCount,
    pendingApprovalCount,
    avgRecoveryDaysRaw,
    injuriesByPosition,
  ] = await Promise.all([
    // 현재 부상자 수 (고유 선수)
    this.prisma.injury.findMany({
      where: { status: { notIn: ['RETURNED'] } },
      select: { playerId: true },
      distinct: ['playerId'],
    }).then(r => r.length),

    // 금주 신규 부상
    this.prisma.injury.count({
      where: { occurredAt: { gte: START_OF_WEEK } },
    }),

    // 7일 내 복귀 예정 (고유 선수)
    this.prisma.injury.findMany({
      where: {
        status: { notIn: ['RETURNED'] },
        expectedReturnDate: { gte: NOW, lte: IN_7_DAYS },
      },
      select: { playerId: true },
      distinct: ['playerId'],
    }).then(r => r.length),

    // 재부상 위험군: 부상 2건 이상 선수 수
    this.prisma.injury.groupBy({
      by: ['playerId'],
      _count: { playerId: true },
      having: { playerId: { _count: { gte: 2 } } },
    }).then(r => r.length),

    // 서류 미비: fileUrl 없거나 DRAFT
    this.prisma.medicalExpense.count({
      where: { OR: [{ fileUrl: null }, { status: 'DRAFT' }] },
    }),

    // 승인 대기: SUBMITTED + LEADER_APPROVED
    this.prisma.medicalExpense.count({
      where: { status: { in: ['SUBMITTED', 'LEADER_APPROVED'] } },
    }),

    // 평균 복귀 소요일
    this.prisma.$queryRaw<{ avg_days: number | null }[]>`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("updatedAt" - "occurredAt")) / 86400))::int AS avg_days
      FROM "Injury"
      WHERE status = 'RETURNED'
    `.then(r => r[0]?.avg_days ?? null),

    // 포지션별 부상 수
    this.prisma.injury.groupBy({
      by: ['playerId'],
      _count: { id: true },
    }).then(async (groups) => {
      const playerIds = groups.map(g => g.playerId)
      const players = await this.prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, position: true },
      })
      const posMap = new Map(players.map(p => [p.id, p.position]))
      const tally: Record<string, number> = { GK: 0, DF: 0, MF: 0, FW: 0 }
      const GK = ['GOALKEEPER']
      const DF = ['CENTER_BACK','LEFT_WING_BACK','RIGHT_WING_BACK','LEFT_FULL_BACK','RIGHT_FULL_BACK']
      const MF = ['DEFENSIVE_MIDFIELDER','CENTRAL_MIDFIELDER','WIDE_MIDFIELDER','ATTACKING_MIDFIELDER','CENTRAL_ATTACK_MIDFIELDER','RIGHT_ATTACK_MIDFIELDER','LEFT_ATTACK_MIDFIELDER']
      const FW = ['STRIKER','SHADOW_STRIKER','WINGER']
      for (const g of groups) {
        const pos = posMap.get(g.playerId)
        if (!pos) continue
        if (GK.includes(pos)) tally.GK += g._count.id
        else if (DF.includes(pos)) tally.DF += g._count.id
        else if (MF.includes(pos)) tally.MF += g._count.id
        else if (FW.includes(pos)) tally.FW += g._count.id
      }
      return tally
    }),
  ])

  return {
    currentInjuredCount,
    weekNewInjuryCount,
    returningIn7DaysCount,
    reinjuryRiskCount,
    incompleteDocCount,
    pendingApprovalCount,
    avgRecoveryDays: avgRecoveryDaysRaw,
    injuriesByPosition,
  }
}
```

### `apps/api/src/dashboard/dashboard.service.ts`

MEDICAL, MEDICAL_DIRECTOR, HEAD_COACH 분기에서 기존 stats와 함께 `getMedicalDashboardStats()`를 `Promise.all`로 병렬 호출하여 `medicalDashboard` 키에 담아 반환.

### `apps/api/src/dashboard/dashboard.controller.ts`

변경 없음. 기존 `/dashboard/stats` 엔드포인트 그대로 사용.

## FE 변경 사항

### `football/src/types/dashboard.ts`

```typescript
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
```

기존 `MedicalStats`, `MedicalDirectorStats`, `HeadCoachStats`에 `medicalDashboard?: MedicalDashboardStats` 필드 추가.

### `football/src/components/dashboard/MedicalSection.tsx` (신규)

- 상단: 부상 현황 4 stat 카드 그리드
- 중단: 행정 현황 stat 카드 (역할에 따라 일부 숨김)
- 하단: 포지션 바 차트 (recharts `BarChart` 또는 기존 InjuryStatsPage의 `BarRow` 패턴 재사용)

### `football/src/pages/dashboard/dashboardConfig.ts`

`showMedicalSection: boolean` 필드를 `DashboardConfig`에 추가. MEDICAL · MEDICAL_DIRECTOR · HEAD_COACH는 `true`.

### `football/src/pages/dashboard/DashboardPage.tsx`

```tsx
{config.showMedicalSection && stats && (stats as HeadCoachStats).medicalDashboard && (
  <MedicalSection
    data={(stats as HeadCoachStats).medicalDashboard!}
    role={user.coachingRole}
  />
)}
```

## 레이아웃 상세

```
─── 기존 stat 카드 (역할별) ───────────────────────
─── 구분선 [의료 현황] ──────────────────────────────
부상 현황 (4-col grid)
  현재 부상자 | 금주 신규 | 7일 내 복귀 | 재부상 위험군

행정 현황 (3-col, MEDICAL/MEDICAL_DIRECTOR만)
  서류 미비 | 승인 대기 | 평균 복귀 소요일

포지션별 부상 추이 (가로 바 차트, 전체 너비)
  GK | DF | MF | FW — 전체 이력 누적
```

HEAD_COACH는 부상 현황 4개 + 승인 대기 1개 + 포지션 차트만 표시.

## 테스트 계획

- BE: `getMedicalDashboardStats()`를 직접 호출해 각 카운트가 seed 데이터와 일치하는지 확인
- FE: MEDICAL / MEDICAL_DIRECTOR / HEAD_COACH 계정으로 각각 로그인 후 섹션이 올바르게 표시되는지 확인
- 부상자 없을 때 0 표시, 평균 복귀 소요일 데이터 없을 때 `—` 표시 확인

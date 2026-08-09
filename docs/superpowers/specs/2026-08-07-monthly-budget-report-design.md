# 월말/연말 운영비 예산 실적 보고서 설계

## 개요

월말 cron job으로 운영비 예산 대비 실적을 집계·저장하고, 재무/HR/시설 담당자 대시보드와 보고서 페이지에 카테고리별 grouped bar chart로 표시한다.

## 데이터 모델

### MonthlyBudgetSnapshot (신규 Prisma 모델)

```prisma
model MonthlyBudgetSnapshot {
  id           Int      @id @default(autoincrement())
  seasonId     Int
  year         Int
  month        Int      // 1~12
  snapshotData Json     // { TRAVEL: {budget, actual}, EQUIPMENT: {...}, ... }
  totalBudget  Int
  totalActual  Int
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  season       Season   @relation(fields: [seasonId], references: [id])

  @@unique([seasonId, year, month])
}
```

`snapshotData` 구조:
```json
{
  "TRAVEL":    { "budget": 800, "actual": 600 },
  "EQUIPMENT": { "budget": 500, "actual": 520 },
  "SCOUTING":  { "budget": 600, "actual": 300 },
  "YOUTH":     { "budget": 0,   "actual": 0   }
}
```

- `budget` = `mandatoryMinimum + (knapsackAllocated ?? 0)` (BudgetCategoryPlan 기준)
- `actual` = 해당 월의 OperatingExpense 합산 (날짜 필터: 해당 연월)

## 백엔드

### Cron Job (`/jobs/monthlyBudgetReport.ts`)

- 스케줄: `0 0 1 * *` (매월 1일 자정, 전월 집계)
- 동작:
  1. 활성 시즌 조회
  2. 전월 `OperatingExpense` 카테고리별 합산
  3. `BudgetCategoryPlan`에서 카테고리별 예산 상한 계산
  4. `MonthlyBudgetSnapshot` upsert (`seasonId + year + month` unique)
- `server.ts`에 `startMonthlyBudgetReportJob()` 등록

### API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/budget-report?seasonId&year&month` | 특정 월 스냅샷 반환. 스냅샷 없으면 실시간 집계 |
| GET | `/budget-report/trend?seasonId` | 시즌 전체 월별 스냅샷 목록 (연말 보고용) |

- 권한: `canReadFinance` (FINANCE_MANAGER, FINANCE_STAFF, ADMIN)
- `auth` 미들웨어 필수 (미인증 시 401)

## 프론트엔드

### OperatingBudgetChart 컴포넌트

- 위치: `football/src/components/dashboard/OperatingBudgetChart.tsx`
- 라이브러리: recharts (이미 설치됨 ^3.9.2)
- 차트 유형: `BarChart` grouped (카테고리별 예산/실적 2개 bar)
- 초과 항목: 실적 bar를 `#ef4444` (red) 로 표시, ⚠️ 라벨
- 총 잔액 요약 텍스트 하단 표시

### 보고서 페이지 (`ReportsPage.tsx`)

- 기존 페이지에 "운영비 예산 실적" 섹션 추가
- 월/연도 필터 (기본값: 현재 월)
- FINANCE_MANAGER, FINANCE_STAFF, ADMIN만 접근

### 대시보드 위젯 (`OperatingBudgetChartSection.tsx`)

- 표시 기준: **현재 시즌 누적** (월 필터 없음)
- 적용 대상 (`dashboardConfig.ts`에 `showBudgetChart: true` 추가):
  - `FINANCE_MANAGER` — 전체 예산 관리
  - `HR_MANAGER` — 인건비 집행 현황 관점
  - `ASSET_MANAGER` — 시설/장비 관련 지출

## 권한 요약

| 역할 | 차트 조회 | 보고서 페이지 |
|------|----------|--------------|
| ADMIN | ✅ | ✅ |
| FINANCE_MANAGER | ✅ | ✅ |
| FINANCE_STAFF | ✅ | ✅ |
| HR_MANAGER | ✅ (대시보드만) | ❌ |
| ASSET_MANAGER | ✅ (대시보드만) | ❌ |

## 네비게이션

대시보드 `OperatingBudgetChartSection` 클릭(또는 "자세히 보기" 링크) → `/reports?section=budget` 로 이동.
`ReportsPage`는 `?section=budget` 쿼리 파라미터 감지 시 해당 섹션으로 자동 스크롤(`useEffect` + `scrollIntoView`).

## 구현 순서

1. Prisma 스키마 `MonthlyBudgetSnapshot` 추가 + migration
2. `/jobs/monthlyBudgetReport.ts` 작성 + `server.ts` 등록
3. `/budget-report` 라우트/서비스/레포 작성
4. `OperatingBudgetChart.tsx` 컴포넌트 작성
5. `OperatingBudgetChartSection.tsx` 대시보드 위젯 작성
6. `dashboardConfig.ts`에 `showBudgetChart` 플래그 추가
7. `DashboardPage.tsx`에 섹션 렌더링 추가
8. `ReportsPage.tsx`에 섹션 추가

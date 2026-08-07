# KPI 대시보드 + 자동화 보고서 설계

## 개요

운영/재무팀 인수인계 문서(§5·§6) 기반으로 8개 KPI를 역할별 대시보드에 추가하고,
월말 운영 지표를 자동 집계해 스냅샷 저장 및 보고서 API를 제공한다.

## 범위 외 (이번 구현 제외)

- 대회 접수 처리시간 — 근거 모델 없음, 별도 이슈
- 민원 처리 리드타임 — 근거 모델 없음, 별도 이슈
- 유소년 출석률 — `YouthAttendance` 모델 미존재, 별도 이슈

## 데이터 모델

### MonthlyBudgetSnapshot (기존 설계 — 예산 실적)

```prisma
model MonthlyBudgetSnapshot {
  id           Int      @id @default(autoincrement())
  seasonId     Int
  year         Int
  month        Int
  snapshotData Json     // { TRAVEL: {budget, actual}, ... }
  totalBudget  Int
  totalActual  Int
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  season       Season   @relation(fields: [seasonId], references: [id])
  @@unique([seasonId, year, month])
}
```

### MonthlyOperationsSnapshot (신규 — 운영 지표)

```prisma
model MonthlyOperationsSnapshot {
  id           Int      @id @default(autoincrement())
  seasonId     Int
  year         Int
  month        Int
  snapshotData Json
  // snapshotData 구조:
  // {
  //   feeCollectionRate: number,      // 회비 수납율 (%)
  //   feeDelinquencyRate: number,     // 미납률 (%)
  //   monthlySettlementRate: number,  // 월말 정산 완료율 (%)
  //   budgetExecutionRate: number,    // 예산 집행률 (%)
  //   overrideCount: number,          // 예외 승인 건수
  //   registrationRate: number,       // 등록 완료율 (%)
  //   attendanceRate: number,         // 출석률 % (프로 선수단)
  //   noticeReadRate: number,         // 공지 열람률 (%)
  // }
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  season       Season   @relation(fields: [seasonId], references: [id])
  @@unique([seasonId, year, month])
}
```

## KPI 계산 공식

| KPI | 공식 |
|-----|------|
| 회비 수납율 | `PAID count / 전체 당월 AcademyFee count × 100` |
| 미납률 | `(OVERDUE + LOCKED) count / 전체 × 100` |
| 월말 정산 완료율 | `당월 말일까지 PAID / 당월 전체 × 100` |
| 예산 집행률 | `OperatingExpense 시즌 합산 / BudgetCategoryPlan ceiling 합산 × 100` |
| 예외 승인 건수 | `BudgetOverrideLog 당월 count` |
| 등록 완료율 | `YouthRegistration status=APPROVED / 전체 시즌 × 100` |
| 출석률 | `TrainingResult 참석 / 전체 sessionId × player 수 × 100` |
| 공지 열람률 | `readAt != null count / 전체 Notification count × 100` |

## 백엔드

### Cron Job (`/jobs/monthlyOperationsReport.ts`)

- 스케줄: `0 0 1 * *` (매월 1일 자정, 전월 집계)
- 동작: 위 8개 KPI 계산 → `MonthlyOperationsSnapshot` upsert
- `server.ts`에 `startMonthlyOperationsReportJob()` 등록

### API 엔드포인트

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/ops-report/kpi?seasonId&year&month` | FINANCE_MANAGER, HR_MANAGER, ADMIN | 특정 월 스냅샷 반환. 없으면 실시간 집계 |
| GET | `/ops-report/annual?seasonId` | FINANCE_MANAGER, HR_MANAGER, ADMIN | 시즌 전체 월별 스냅샷 목록 (연간 보고용 온디맨드 집계) |

## 프론트엔드

### KPI 카드 컴포넌트

기존 `StatCard` 재사용 또는 `KpiCard` 신규 (진행률 bar 포함).

#### FINANCE_MANAGER 대시보드 추가 카드

| 카드 | 단위 | 강조 조건 |
|------|------|---------|
| 회비 수납율 | % | < 80% 시 yellow |
| 미납률 | % | > 10% 시 red |
| 예산 집행률 | % | > 90% 시 yellow, > 100% 시 red |
| 예외 승인 건수 | 건 | > 0 시 highlight |
| 월말 정산 완료율 | % | < 100% 시 yellow |

#### HR_MANAGER 대시보드 추가 카드

| 카드 | 단위 | 강조 조건 |
|------|------|---------|
| 등록 완료율 | % | < 90% 시 yellow |
| 출석률 (프로) | % | < 80% 시 red |
| 공지 열람률 | % | < 60% 시 yellow |

### dashboardConfig.ts 변경

`showOpsKpi: boolean` 플래그 추가.
- `FINANCE_MANAGER`: `showOpsKpi: true` (재무 5개)
- `HR_MANAGER`: `showOpsKpi: true` (HR 3개)
- `ADMIN`: 전체 8개

### 연간 보고서 페이지

`/reports` 페이지에 "연간 운영 보고" 탭 추가.
월별 스냅샷 8개 지표를 라인 차트(recharts)로 표시.
시즌 선택 드롭다운으로 연도 전환.

## 구현 순서

1. Prisma 스키마 `MonthlyOperationsSnapshot` 추가 + migration
2. `/jobs/monthlyOperationsReport.ts` KPI 계산 로직 작성
3. `server.ts` 잡 등록
4. `/ops-report` 라우트·서비스·레포 작성
5. `dashboardConfig.ts` `showOpsKpi` 플래그 추가
6. `DashboardPage.tsx` KPI 카드 섹션 렌더링
7. `/reports` 연간 보고 탭 + 라인 차트 추가

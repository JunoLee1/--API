# 홈경기 티켓 판매 관리 설계

## 개요

재무팀이 홈경기별 티켓 판매 실적을 기록·조회하고, 저장 시 원장(LedgerEntry)에 자동 반영한다.
경기 상세 페이지에서 입력, 재무 메뉴에서 집계·조회.

---

## 도메인 결정 사항

| 항목 | 결정 |
|------|------|
| 경기 연결 | `SalesRecord.matchId Int?` (DB 레벨 optional, TICKET 타입 시 필수 검증) |
| 홈경기 검증 | `Match.homeTeamName === "FC Seoul"` 백엔드 검증, 아니면 `AWAY_MATCH_TICKET_NOT_ALLOWED` 400 |
| 입력 단위 | 수량(quantity) + 단가(unitPrice) 한 줄, `totalAmount = quantity × unitPrice` 자동 계산 |
| 원장 자동 생성 | `SalesRecord.create` 트랜잭션 내 `LedgerEntry(category: TICKET_SALES)` 동시 생성 |
| 권한 | FINANCE_MANAGER/FINANCE_STAFF/ADMIN — 입력+조회, FRONT_OFFICE — 조회 전용 |
| 재무 메뉴 뷰 | 경기별 합산 요약 상단 + 전체 판매 기록 테이블 |
| 대시보드 KPI | FINANCE_MANAGER 대시보드에 시즌 누적 티켓 수입 카드 1개 |

---

## 데이터 모델 변경

### SalesRecord (수정)

```prisma
model SalesRecord {
  id          Int          @id @default(autoincrement())
  type        SalesType
  quantity    Int
  unitPrice   Decimal      @db.Decimal(12, 2)
  totalAmount Decimal      @db.Decimal(12, 2)
  currency    CurrencyCode @default(KRW)
  saleDate    DateTime
  description String?
  matchId     Int?                           // 추가: TICKET 타입 시 필수
  createdById Int
  createdAt   DateTime     @default(now())

  createdBy User   @relation("SalesRecordCreator", fields: [createdById], references: [id])
  match     Match? @relation(fields: [matchId], references: [id])  // 추가
}
```

### Match (back-relation 추가)

```prisma
salesRecords SalesRecord[]
```

---

## 백엔드

### 검증 로직 (sales.service.ts 확장)

```typescript
// TICKET 타입일 때:
// 1. matchId 필수
// 2. Match 조회 → homeTeamName === "FC Seoul" 확인
// 3. LedgerEntry 자동 생성 (트랜잭션)
```

### 신규 레포 메서드 (sales.repo.ts)

| 메서드 | 설명 |
|--------|------|
| `findTicketsByMatch(matchId)` | 특정 경기 티켓 판매 목록 |
| `findTicketSummaryByMatch(seasonId)` | 경기별 합산: `{ matchId, matchDate, homeTeamName, awayTeamName, totalAmount, totalQuantity }[]` |
| `sumTicketRevenueBySeason(seasonId)` | 시즌 누적 티켓 수입 합계 (대시보드용) |

### API 엔드포인트

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/sales` | canReadFinance \| FRONT_OFFICE | 전체 판매 기록 목록 |
| POST | `/sales` | canWriteFinance | 판매 기록 생성 |
| GET | `/sales/ticket-summary?seasonId=` | canReadFinance \| FRONT_OFFICE | 경기별 티켓 합산 |
| GET | `/sales/ticket-season-total?seasonId=` | canReadFinance \| FRONT_OFFICE | 시즌 누적 티켓 수입 |
| GET | `/sales/by-match/:matchId` | canReadFinance \| FRONT_OFFICE | 경기별 판매 목록 |

**기존 `/sales` 엔드포인트**: 권한 미들웨어 추가 (현재 열려 있음)

### CreateSalesRecordDto 확장

```typescript
interface CreateSalesRecordDto {
  type: "TICKET" | "UNIFORM" | "OTHER"
  quantity: number
  unitPrice: number
  currency?: "KRW" | "USD" | "EUR" | "GBP"
  saleDate: string
  description?: string
  matchId?: number   // 추가: TICKET 타입 시 필수
}
```

---

## 프론트엔드

### 신규 파일

- `football/src/types/sales.ts` — `SalesRecord`, `TicketMatchSummary`, `CreateSalesRecordDto`
- `football/src/services/sales.service.ts` — `salesApi.list()`, `salesApi.create()`, `salesApi.ticketSummary(seasonId)`, `salesApi.ticketSeasonTotal(seasonId)`, `salesApi.byMatch(matchId)`
- `football/src/pages/finance/TicketSalesPage.tsx` — 재무 메뉴 티켓 판매 페이지

### 수정 파일

- `football/src/pages/match/MatchDetailPage.tsx` — 티켓 판매 섹션 추가
- `football/src/pages/dashboard/dashboardConfig.ts` — `showTicketRevenue: boolean`
- `football/src/pages/dashboard/DashboardPage.tsx` — 티켓 수입 KPI 카드 렌더링
- `football/src/layouts/AppShell.tsx` — 재무 메뉴에 "티켓 판매" 링크 추가

### MatchDetailPage 티켓 판매 섹션

- 표시 조건: `role === FINANCE_MANAGER | FINANCE_STAFF | ADMIN | FRONT_OFFICE` AND 홈경기(`homeTeamName === "FC Seoul"`)
- 입력 폼 (FINANCE_MANAGER/FINANCE_STAFF/ADMIN만): 수량, 단가, 날짜, 메모
- 판매 목록: 해당 경기 기존 판매 기록 테이블 (삭제 버튼 포함)

### TicketSalesPage 구성

**상단: 경기별 요약 테이블**
| 경기일 | 홈 | vs 어웨이 | 판매량 | 수입 |
|--------|-----|-----------|--------|------|

**하단: 전체 판매 기록 테이블**
| 날짜 | 경기 | 수량 | 단가 | 총액 | 메모 |

시즌 선택 드롭다운 (기본값: 현재 시즌)

### 대시보드 KPI 카드

- `FINANCE_MANAGER` 대시보드: `showTicketRevenue: true`
- 표시: "시즌 티켓 수입 ₩XX,XXX,XXX"
- 클릭 시 `/finance/ticket-sales` 로 이동

---

## 권한 요약

| 역할 | 입력 | 삭제 | 조회 |
|------|------|------|------|
| ADMIN | ✅ | ✅ | ✅ |
| FINANCE_MANAGER | ✅ | ✅ | ✅ |
| FINANCE_STAFF | ✅ | ❌ | ✅ |
| FRONT_OFFICE | ❌ | ❌ | ✅ |
| 기타 | ❌ | ❌ | ❌ |

---

## 구현 순서

1. Prisma 스키마 `SalesRecord.matchId` + Migration
2. `sales.repo.ts` 신규 메서드 추가
3. `sales.service.ts` 검증 + 원장 자동 생성 + 신규 메서드
4. `sales.controller.ts` 권한 미들웨어 + 신규 엔드포인트
5. `sales.routes.ts` 신규 라우트 추가
6. 프론트 타입 + API 서비스
7. `MatchDetailPage.tsx` 티켓 판매 섹션
8. `TicketSalesPage.tsx` 신규 페이지
9. `AppShell.tsx` 네비 링크
10. `dashboardConfig.ts` + `DashboardPage.tsx` KPI 카드

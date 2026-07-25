# Match Starting Lineup 설계 스펙

## Goal
경기 상세 페이지에서 COACHING_STAFF / HEAD_COACH가 포메이션과 선발·후보 라인업을 드래그앤드롭으로 구성하고, HEAD_COACH가 최종 확정하는 기능.

## Architecture
- 기존 `MatchSquad`(경기 참여 명단)와 분리된 전용 테이블 2개 신규 추가
- BE: Express + Prisma, FE: React + @dnd-kit/core, 기존 `FootballPitch` / `FORMATION_LAYOUTS` 재사용
- 저장: 명시적 저장 버튼으로 전체 lineup upsert (실시간 자동저장 없음)

## Tech Stack
Express + Prisma (BE), React + @dnd-kit/core + 기존 squad 컴포넌트 (FE)

---

## 데이터 모델

### 신규 Prisma 모델

```prisma
model MatchLineup {
  id            Int        @id @default(autoincrement())
  matchId       Int        @unique
  formation     String     // "4-3-3", "4-4-2" 등 SUPPORTED_FORMATIONS 값
  isConfirmed   Boolean    @default(false)
  confirmedAt   DateTime?
  confirmedById Int?

  match       Match      @relation(fields: [matchId], references: [id])
  confirmedBy User?      @relation("LineupConfirmations", fields: [confirmedById], references: [id])
  slots       LineupSlot[]

  @@index([matchId])
}

model LineupSlot {
  id        Int     @id @default(autoincrement())
  lineupId  Int
  playerId  String
  slotKey   String  // FORMATION_LAYOUTS의 SlotDef.key 값 (예: "GK", "CB1", "LW")
                    // isStarter=false(후보)인 경우 "BENCH_0", "BENCH_1" 등 사용
  isStarter Boolean @default(true)

  lineup  MatchLineup @relation(fields: [lineupId], references: [id], onDelete: Cascade)
  player  Player      @relation(fields: [playerId], references: [id])

  @@unique([lineupId, slotKey])   // 슬롯 하나에 선수 하나
  @@unique([lineupId, playerId])  // 선수 하나는 슬롯 하나에만
  @@index([lineupId])
}
```

### 기존 모델 관계 추가
- `Match`: `lineup MatchLineup?` 추가
- `Player`: `lineupSlots LineupSlot[]` 추가
- `User`: `lineupConfirmations MatchLineup[] @relation("LineupConfirmations")` 추가

---

## API

| Method | Path | 설명 | 허용 역할 |
|--------|------|------|-----------|
| GET | `/api/matches/:id/lineup` | 라인업 조회 | 인증된 전체 |
| PUT | `/api/matches/:id/lineup` | 라인업 전체 저장(upsert) | ADMIN, COACHING_STAFF, HEAD_COACH |
| POST | `/api/matches/:id/lineup/confirm` | 라인업 확정 | ADMIN, HEAD_COACH |

### GET 응답 형태
```typescript
{
  matchId: number
  formation: string
  isConfirmed: boolean
  confirmedAt: string | null
  slots: {
    slotKey: string
    isStarter: boolean
    player: { id: string; playerName: string; position: string }
  }[]
}
```

### PUT 요청 형태
```typescript
{
  formation: string
  slots: {
    playerId: string
    slotKey: string
    isStarter: boolean
  }[]
}
```

PUT은 기존 lineup의 모든 slot을 삭제 후 재생성 (replace 방식). 트랜잭션으로 처리.

---

## 파일 구조

### BE (신규)
- `apps/api/src/match/dto/lineup.dto.ts` — DTO 인터페이스
- `apps/api/src/match/match.lineup.repo.ts` — Prisma 쿼리
- `apps/api/src/match/match.lineup.service.ts` — 비즈니스 로직
- `apps/api/src/match/match.lineup.controller.ts` — HTTP 핸들러

### BE (수정)
- `apps/api/src/match/match.routes.ts` — lineup 라우트 등록
- `apps/api/prisma/schema.prisma` — 모델 추가

### FE (신규)
- `football/src/types/lineup.ts` — 타입 + 상수
- `football/src/services/lineup.service.ts` — API 호출
- `football/src/pages/matches/MatchLineupPage.tsx` — 메인 페이지 (플레이스홀더 교체)

### FE (수정)
- `football/package.json` — @dnd-kit/core, @dnd-kit/utilities 추가

---

## 프론트엔드 UI

### MatchLineupPage 레이아웃
```
┌─────────────────────────────────────────────────────┐
│ ← 경기 상세   포메이션[4-3-3▾]    [저장]  [✓ 확정] │  ← 확정은 HEAD_COACH만
├────────────────┬────────────────────────────────────┤
│ 선수 풀        │  풋볼 피치 (FootballPitch 재사용)   │
│ (드래그 소스)  │  슬롯 = 드롭 존                     │
│                │  빈 슬롯: 점선 원                   │
│ - 부상자 표시  │  채워진 슬롯: 선수명 표시           │
│ - 배치된 선수  ├────────────────────────────────────┤
│   는 흐리게    │  후보 벤치 (드롭 존)                │
│                │  "선수를 여기로 드래그"             │
└────────────────┴────────────────────────────────────┘
│ ● 선발 N/11 배치됨 · [저장되지 않음]               │
└─────────────────────────────────────────────────────┘
```

### 드래그앤드롭 동작
- **소스:** 선수 풀 카드 (배치된 선수는 흐리게, 드래그 불가)
- **드롭 존:** 피치의 각 슬롯 + 벤치 영역
- **슬롯→슬롯 이동:** 이미 배치된 선수를 다른 슬롯으로 드래그하면 교체
- **슬롯→풀 복귀:** 배치된 선수를 선수 풀 위로 드래그하면 제거
- 드래그 중 드롭 가능 존 하이라이트

### 확정 동작
- `isConfirmed = true`가 된 이후에도 편집·저장 가능 (확정 상태 유지)
- 확정 버튼은 `user.role === 'HEAD_COACH' || user.role === 'ADMIN'`일 때만 표시
- 선수 앱 노출: `isConfirmed = true`인 경우에만 (CONTEXT.md 기존 룰)

---

## 권한 정리

| 역할 | 조회 | 편집·저장 | 확정 |
|------|------|-----------|------|
| PLAYER / FRONT_OFFICE | ✅ | ❌ | ❌ |
| COACHING_STAFF | ✅ | ✅ | ❌ |
| HEAD_COACH | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ |

---

## 테스트

### BE
- `PUT /:id/lineup` — 정상 저장, 중복 playerId 거부(409), 중복 slotKey 거부(409)
- `POST /:id/lineup/confirm` — COACHING_STAFF 403, HEAD_COACH 200
- 트랜잭션 롤백: 슬롯 저장 도중 실패 시 lineup 상태 유지

### FE
- 선수 드래그 → 슬롯에 드롭 → 선수 풀에서 제거 + 슬롯에 표시
- 저장 버튼: 변경사항 있을 때만 활성화
- HEAD_COACH가 아닐 때 확정 버튼 미렌더링
- 확정 후 재편집 → 저장 → `isConfirmed` 여전히 `true`

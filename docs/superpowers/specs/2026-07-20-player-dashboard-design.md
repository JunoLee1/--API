# 선수용 대시보드 & 선수 상세 정보 UI Design Spec

**Date:** 2026-07-20  
**Goal:** 선수 상세 페이지(대시보드 헤더 + 레이더 차트 + Stats Tab + 등번호 시스템)의 도메인 모델 및 UI 설계 확정

**참조 ADR:** ADR-0006 (등번호 엔티티), ADR-0007 (강점/약점 알고리즘), ADR-0002 확장 (Stats Tab fetch)

---

## 1. 스키마 변경 사항

### 신규 Enum

```prisma
enum JerseyNumberStatus {
  AVAILABLE
  OCCUPIED
  RETIRED
  RESERVED
}

enum MarketValueSource {
  MANUAL
  EXTERNAL_API
}
```

### Player 변경

```prisma
// 제거
jersey_number  Int

// 추가
play_style           String?   // PlayStyle enum 값 확정 후 enum으로 전환 예정
current_market_value Float?
jersey_numbers       JerseyNumber[]
market_value_history MarketValueHistory[]
```

### 신규 모델: JerseyNumber

```prisma
model JerseyNumber {
  id        Int                @id @default(autoincrement())
  number    Int
  status    JerseyNumberStatus @default(AVAILABLE)
  team_id   Int
  team      Team               @relation(fields: [team_id], references: [id])
  player_id String?
  player    Player?            @relation(fields: [player_id], references: [id])
  // prospect_id 추가 예정 — Prospect 모델 구현 후 연결

  @@unique([number, team_id])
}
```

### 신규 모델: MarketValueHistory

```prisma
model MarketValueHistory {
  id             Int               @id @default(autoincrement())
  value          Float
  source         MarketValueSource
  recorded_at    DateTime          @default(now())
  recorded_by_id Int?
  player_id      String
  player         Player            @relation(fields: [player_id], references: [id])
}
```

### 타입 수정 (버그)

| 모델 | 필드 | 변경 |
|------|------|------|
| `Player_match_stats` | `xG`, `xA` | `Int?` → `Float?` |
| `Player_season_stats` | `avg_xG`, `avg_xA` | `Int?` → `Float?` |
| `Team_match_stats` | `xG` | `Int` → `Float` |

### 신규 필드

| 모델 | 필드 | 타입 |
|------|------|------|
| `Player_match_stats` | `aerial_duel_success_rate` | `Float?` |
| `Player_season_stats` | `avg_aerial_duel_success_rate` | `Float?` |

---

## 2. 등번호 시스템 (JerseyNumber)

### 설계 원칙

- 팀별 독립 관리 — 1군 7번 ≠ 유소년 7번 (`@@unique([number, team_id])`)
- 선수와 독립 존재 — 은퇴 번호(RETIRED)는 `player_id = null`

### 상태 전환

```
AVAILABLE → OCCUPIED  (선수 배정)
OCCUPIED  → AVAILABLE (번호 해제)
AVAILABLE → RETIRED   (영구 결번, GM 전용)
AVAILABLE → RESERVED  (영입 후보 예약, GM 전용, prospectId 연결)
RESERVED  → OCCUPIED  (영입 성사 후 배정)
RETIRED   → AVAILABLE (ADMIN 전용 override)
```

### 권한

| 액션 | 권한 |
|------|------|
| RETIRED 설정 | GM 전용 |
| RESERVED 설정 | GM 전용 |
| OCCUPIED 전환 / AVAILABLE 복원 | GM + ADMIN |
| RETIRED → AVAILABLE (재활성화) | **ADMIN 전용** |

### 충돌 처리

- **OCCUPIED 번호 배정 시도:** 시스템 차단. 기존 선수 번호 해제 후 재배정 2단계 강제.
- **RESERVED 번호 배정 시도:** 예약 해제 또는 동일 GM이 직접 배정하는 경우만 허용.
- **RETIRED 재활성화:** ADMIN override만 허용.

---

## 3. 시장 가치 (MarketValue)

- **현재값:** `Player.current_market_value: Float?`
- **입력 방식:** 현재 TD/SCOUT 수동 입력 → 향후 외부 API 어댑터 패턴으로 교체
- **열람 권한:** GM, TD, ADMIN 전용 (이적료와 동일 기준). PLAYER 본인 비공개.
- **이력:** `MarketValueHistory` — 수동 업데이트 시 즉시 + 월 1회 cron 스냅샷 (`source`로 구분)
- **감가 상각 차트:** `MarketValueHistory` 시계열로 렌더링, GM·TD·ADMIN만 열람

---

## 4. 플레이 스타일 (playStyle)

- **저장 필드:** `Player.play_style: String?` (추후 `PlayStyle` 고정 enum 전환)
- **결정 방식:** `PlayerMatchStats` 집계 기반 알고리즘이 초기값 제안 → HEAD_COACH가 확정·수정
- **표시 권한:** 전 역할 + PLAYER 본인 (자기 동기 부여 목적)
- **데이터 부족 (신인 등):** `null` 허용, UI에서 "미분류"로 표시

---

## 5. 레이더 차트

### 포지션 그룹별 6축

| 그룹 | 축 (스키마 필드) |
|------|----------------|
| **공격수** (striker·shadow_striker·winger·*AM) | xG+goals / xA+assist / sprint / clear_cut_chance_rate / passing_accuracy / penalty+free_kick_conversion_rate |
| **미드필더** (CDM·CM·CAM) | passing_accuracy / xA+assist / tackle_success_rate+interception / sprint / xG+goals / free_kick_conversion_rate |
| **수비수** (CB·WB·FB) | tackle_success_rate / interception / clearance / aerial_duel_success_rate / passing_accuracy / sprint |
| **골키퍼** | shots_on_target-shot_allowed(역산) / passing_accuracy / crosses_completed / shot_blocked / shot_allowed / free_kick_conversion_rate |

### 강점/약점 태그 알고리즘

```
강점 = 해당 축 점수 ≥ 70 AND 팀 내 동일 포지션 그룹 상위 25%
약점 = 해당 축 점수 ≤ 40 OR 팀 내 동일 포지션 그룹 하위 25%
표본 부족 (3명 미만): 상대 비교 비활성화, 절대 임계값만 적용
```

---

## 6. Stats Tab fetch 전략

ADR-0002 하이브리드 원칙 연장 적용:

```
GET /players/:id/match-stats      → Season History + Detail Metrics
GET /players/:id/training-results → Training Records
```

단일 `/players/:id/stats`로 묶지 않음 — 경기 스탯과 훈련 기록은 도메인이 달라 결합도 과도.

---

## 7. PLAYER 본인 뷰 공개 범위

| 컴포넌트 | 공개 |
|----------|------|
| 레이더 차트 (강점/약점 태그) | ✅ |
| `play_style` 라벨 | ✅ |
| 본인 `Contract.salary` | ✅ |
| `TrainingResult` (출석·점수·피드백) | ✅ |
| `PlayerDevelopmentPlan` (ACTIVE 이후) | ✅ |
| `TacticalAnalysis` (CONFIRMED만) | ✅ |
| Player Motivation 섹션 | ✅ |
| `Transfer.fee` 이적료 | ❌ |
| `current_market_value` / `MarketValueHistory` | ❌ |
| 타 선수 데이터 일체 | ❌ |

---

## 8. Player Motivation Design (PLAYER 본인 전용)

세 가지 레이어를 함께 표시:

- **(A) 훈련-경기 상관관계:** `TrainingResult.performanceScore` 추세 + 경기 스탯 추세 오버레이
- **(B) 훈련 성실도 배지:** 출석률 + `VideoAssignment` 완료율 숫자 카드
- **(C) 시즌 평균 대비 현재 폼:** 최근 N경기 vs 시즌 전체 평균, 레이더 차트 위 `±%` 오버레이

---

## 9. 남은 작업

| 항목 | 상태 |
|------|------|
| `PlayStyle` enum 값 목록 확정 후 `String?` → enum 마이그레이션 | ⏳ |
| `JerseyNumber.prospect_id` — Prospect 모델 구현 후 연결 | ⏳ |
| `MarketValueHistory` 월 cron 스냅샷 구현 | ⏳ |
| Play Style 자동 분류 알고리즘 구현 | ⏳ |
| 강점/약점 태그 알고리즘 BE 구현 | ⏳ |
| `GET /players/:id/match-stats` 엔드포인트 구현 | ⏳ |
| `GET /players/:id/training-results` 엔드포인트 구현 | ⏳ |
| Player Motivation A+B+C 컴포넌트 구현 | ⏳ |

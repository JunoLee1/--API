# ADR 0009: 팀 스탯 자동 집계 + passesAttempted/passesCompleted

**날짜:** 2026-07-25
**상태:** 채택

## 결정

`PlayerMatchStats.passAccuracy Float`를 제거하고 `passesAttempted Int` + `passesCompleted Int`로 교체한다.
`TeamMatchStats`의 슈팅·패스·파울·태클·인터셉션·클리어런스·유효슛·xG는 수동 입력 대신 `recalculateTeamStats(matchId)`로 자동 집계한다.
팀 스탯 입력 폼에는 점유율·경고·퇴장·코너킥·오프사이드 5개만 남긴다.

## 이유

- `passAccuracy Float`(비율)는 집계 불가 — 70/100 + 50/80이 60.0%인지 알 수 없음.
  원시 카운트가 있어야 팀 합계 패스 성공률을 정확히 계산할 수 있다.
- 팀 스탯의 슈팅·패스 등은 `PlayerMatchStats`의 합산으로 구해야 하는 값이므로,
  수동 입력하면 선수 기록과 팀 기록이 불일치할 수 있다.

## 트레이드오프

- **선택한 방식:** 자동 집계. 선수 스탯 upsert·ShotEvent 생성/삭제 후 항상 `recalculateTeamStats` 호출.
- **대안:** 팀 스탯 전체를 수동 입력. 구현이 단순하나 데이터 불일치 위험.

## 집계 로직

| TeamMatchStats 필드 | 출처 |
|---------------------|------|
| `shots` | `PlayerMatchStats.shots` 합계 |
| `passes` | `passesAttempted` 합계 |
| `passAccuracy` | `passesCompleted / passesAttempted × 100` |
| `fouls` | `foulsCommitted` 합계 |
| `tackles` | `tackles` 합계 |
| `interceptions` | `interceptions` 합계 |
| `clearances` | `clearances` 합계 |
| `shotsOnTarget` | `ShotEvent.result IN (GOAL, ON_TARGET)` 카운트 |
| `xG` | `ShotEvent.xG` 합계 |
| `possession` | 수동 입력 |
| `yellowCards` | 수동 입력 |
| `redCards` | 수동 입력 |
| `corners` | 수동 입력 |
| `offsides` | 수동 입력 |

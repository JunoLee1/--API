# Team을 하드코딩 enum이 아닌 ADMIN 관리 엔티티로 설계

구단마다 유소년팀 구성이 다르고(U18만 있는 곳, U18+U15+U12 운영하는 곳), 팀이 늘거나 줄 수 있다. `FIRST_TEAM | U18 | U15` 같은 enum으로 고정하면 팀 추가·삭제마다 코드 변경이 필요하다. ADMIN이 `Team { name, type, ageGroup }` 레코드를 직접 생성·관리하도록 설계했다.

## Considered Options

- **enum 하드코딩**: 단순하지만 팀 구성 변경 시 배포 필요. 구단별 커스터마이징 불가.
- **ADMIN 관리 엔티티 (채택)**: 팀 추가·삭제·비활성화를 코드 변경 없이 처리. `Team.trackStats`, `Team.requiresContract` 등 팀별 설정도 함께 관리.

## Consequences

Player, TrainingSession, Match, Coach, User(COACHING_STAFF) 전체에 `teamId → Team` FK가 붙는다. 기존 단일팀 데이터는 마이그레이션 시 FIRST_TEAM 레코드를 먼저 생성하고 일괄 backfill해야 한다.

# 등번호를 JerseyNumber 별도 엔티티로 분리한다

`Player.jerseyNumber: Int?` 필드 대신 `JerseyNumber` 엔티티를 분리한다.

## Considered Options

- **`Player.jerseyNumber` 단순 필드**: 구현 최소화. 단, 은퇴 번호(Retired)를 표현하려면 선수 없이 번호만 존재해야 하는데 Player 레코드가 없으면 저장 불가. 히스토리·충돌 추적도 불가.
- **`Player.jerseyNumber` + `AuditLog` 이력 대체**: 최소 변경이나 비즈니스 로직이 AuditLog에 섞임.
- **`JerseyNumber` 별도 엔티티 (채택)**: 선수와 독립 존재. 은퇴 번호·영입 후보 예약(`Reserved → prospectId`) 표현 가능. 충돌 워크플로우가 자연스럽게 엔티티 상태 전환으로 모델링됨.

## Decision

`JerseyNumber` 별도 엔티티로 분리한다.

**필드:** `number: Int`, `teamId → Team`, `status: AVAILABLE | OCCUPIED | RETIRED | RESERVED`, `playerId? → Player`, `prospectId? → Prospect`

**유니크 제약:** `@@unique([number, teamId])` — 팀별 독립 관리 (1군 7번 ≠ 유소년 7번)

## Consequences

**충돌 워크플로우:**
- `OCCUPIED` 번호 배정 시도 → 시스템 차단. 기존 번호 해제 후 재배정 2단계 강제.
- `RESERVED` 번호 → 예약 해제 또는 동일 GM이 직접 배정하는 경우만 허용.
- `RETIRED` 재활성화 → **ADMIN 전용 override**. GM 포함 불가.

**쓰기 권한:**
- `RETIRED` / `RESERVED` 설정: GM 전용
- `OCCUPIED` 전환 / `AVAILABLE` 복원: GM + ADMIN

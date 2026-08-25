# ADR 0016: 팀원 CRUD — 팀장 자율 관리 + DeptRole 확장

**Status:** Accepted
**Date:** 2026-08-25

## Context

팀장이 자기 팀원을 UI로 관리할 API가 부재했다. `Department.headId`는 승인 권한 판정(자산 신청·채용 발령 결재 라인)에만 쓰이고, 조직도 표현·이동 관리는 불가능했다. 팀원 이동은 admin이 DB를 직접 조작하거나 seed를 수정하는 방식으로만 가능했고, 이는 실사용 시 관리자 부담으로 이어졌다. 또한 `DeptRole`이 `MANAGER | MEMBER` 2-value뿐이라 부팀장·선임·인턴 같은 조직 내 세부 역할을 표현할 수 없었다.

## Decision

**팀장 자율 팀원 관리 API + DeptRole 6-value 확장**을 채택한다.

- **`Department.headId` 재사용**: 승인 권한 판정의 진실 소스(source of truth)를 유지. `UserDepartment.role`은 조직도 표현에만 사용하며 두 필드 간 sync는 필수 아님 — 설계 명시.
- **`DeptRole` 6-value 확장**: `LEADER | DEPUTY | MANAGER | SENIOR | MEMBER | INTERN`. 기존 `MANAGER | MEMBER` 값은 그대로 유지하여 backfill 불필요. Postgres `ALTER TYPE ADD VALUE`는 트랜잭션 밖 실행 필요.
- **CRUD 스코프**: 자기 leaf dept 팀원만 관리 가능. `ADMIN | SUPER_ADMIN | GM`은 escape hatch로 전 부서 접근 허용. 엔드포인트 6개: `list / add / updateRole / remove / transfer / updateHead`.
- **팀장 승계**: 부서장(`parent.headId`) 또는 admin만 가능. 팀장 본인은 후임을 직접 임명 불가.
- **신규 유저 create 제외**: 신규 유저 생성은 `HiringDispatch`가 담당 (승인 skip 위험). 이 API는 기존 유저 assign만 허용.
- **Self-approval 3-block**: role change / remove / head 자기 임명 모두 self 차단. DB 제약 불가, 서비스 레이어 명시 검증.
- **단독 소속 remove → `MUST_TRANSFER` 400**: 유저가 해당 부서 하나만 소속인 경우 remove 대신 강제 이관 유도 — 무소속 유저 방지.
- **Transfer 원자적 실행**: `prisma.$transaction` 안에서 `UserDepartment.delete + create` 처리.
- **Audit log fire-and-forget**: 5 actions — `TEAM_MEMBER_ADDED | TEAM_MEMBER_REMOVED | TEAM_MEMBER_TRANSFERRED | TEAM_MEMBER_ROLE_CHANGED | DEPARTMENT_HEAD_CHANGED`. 실패해도 주 트랜잭션은 롤백하지 않음.

## Alternatives Considered

**복수 팀장 (`Department.leaderIds Int[]`):** asset-request·hiring-dispatch·medical-partnership 3개 워크플로우가 `Department.headId` 단일 참조를 전제하므로 전면 rewrite 필요. 기각.

**신규 유저 create도 팀원 CRUD에서 허용:** `HiringDispatch` 3-stage 결재를 우회하면 재무 재검증·임원 승인이 skip됨. HiringDispatch 도입 취지를 정면으로 위반. 기각.

**부서장 재귀 관리 (부서장이 leaf 팀원 직접 CRUD):** 상위 관리자 권한 판정 로직이 복잡해지고, 팀장 임명만으로도 충분히 자율 위임됨. 기각.

**soft delete (`UserDepartment.leftAt`):** 이력 보존 목적으로 검토했으나 별도 audit trail 계획이 있으며, 현재 scope에서 관리 복잡도만 증가. Deferred.

## Consequences

**Positive:**
- 팀장 UI 자율성 확보 → admin DB 직접 조작 부담 감소.
- 조직도 세분화 — 부팀장·선임·인턴 표현 가능.
- 승인 권한(`Department.headId`)과 조직도 표현(`UserDepartment.role`) 관심사 분리 명확화.

**Negative:**
- `DeptRole` 4값 추가로 enum migration 필요 (Postgres `ALTER TYPE ADD VALUE`는 트랜잭션 밖 실행 — migration 파일에서 `BEGIN/COMMIT` 분리 처리).
- `Department.headId`와 `UserDepartment.role=LEADER` 간 sync 없음 — 설계 명시이지만 UI·리포트에서 두 값이 불일치할 수 있음. headId를 진실로 취급하는 원칙을 팀 전체가 인지해야 함.

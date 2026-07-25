# Coach를 User와 분리된 별도 엔티티로 설계

코치 후보 선발 프로세스(후보 등록 → 유사도 평가 → 승인 → 계약)를 지원하려면 "아직 시스템 계정이 없는 외부 후보" 단계부터 "재직 중", "퇴임 후 이력 보존"까지 생애주기를 추적해야 한다. User 엔티티는 로그인 계정을 전제하므로 이 요구를 수용할 수 없다. Player가 User와 별개 엔티티인 것과 동일한 이유로 Coach를 분리했다.

## Considered Options

- **User 속성으로만 관리**: `coachingRole=HEAD_COACH`인 User가 곧 감독. 후보 단계 데이터를 담을 수 없고, 퇴임 후 계정 비활성화 시 이력이 단절된다.
- **Coach 별도 엔티티 (채택)**: 후보(CANDIDATE)부터 퇴임(RETIRED)까지 독립 레코드 유지. 재직 중일 때만 `userId`로 User와 연결.

## Consequences

Coach 채용 워크플로우(CoachHiringRound, 역할별 평가 스키마, packageLeadId)가 User 없이 동작한다. 계약 완료(CONTRACTED) 시 ADMIN이 별도로 초대 이메일을 발송해야 한다.

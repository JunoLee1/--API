# Master Policy를 별도 엔티티로 분리하지 않음

인수인계서는 구단 전술 가이드라인("Master Policy")을 독립 개념으로 명시했으나, 별도 엔티티를 두지 않기로 했다. 현직 HEAD_COACH의 `HeadCoachEvaluation` 데이터가 곧 구단 기준 모델이다. 감독이 교체되면 새 HEAD_COACH의 평가 데이터가 자동으로 기준이 된다.

## Considered Options

- **별도 Policy 엔티티 (B안)**: `TacticalPolicy { pressingIntensity, possessionTarget, ... }`를 독립적으로 관리. 구단이 코치 실측값과 무관하게 목표값을 별도 편집 가능.
- **HeadCoachEvaluation 직접 참조 (채택)**: 정책과 실측값을 일치시킴. 중복 엔티티 없음. 감독 교체 시 자동 갱신.

## Consequences

구단이 "감독 데이터와 무관한 목표값"을 따로 설정할 수 없다. 정책 목표를 조정하려면 감독과 합의 후 HeadCoachEvaluation을 수정해야 한다. 향후 독립 편집이 필요해지면 HeadCoachEvaluation에서 TacticalPolicy를 분리하는 마이그레이션이 필요하다.

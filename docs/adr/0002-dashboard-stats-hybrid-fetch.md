# 대시보드 숫자 카드는 전용 API로 묶고, 나머지 위젯은 기존 API를 재사용한다

위젯별 독립 fetch는 페이지 로드 시 HTTP 요청이 5개 이상 발생해 체감 속도가 느리다. 반대로 단일 `/dashboard` API는 역할별 위젯 조합이 바뀔 때마다 BE·FE를 동시에 수정해야 해서 결합도가 높다. 절충안으로 숫자 카드 집계만 `GET /dashboard/stats` 하나로 묶고(역할 기반 응답 구조), 액션 요청·최근 활동·일정은 `/notifications/my` 등 기존 엔드포인트를 그대로 쓴다. 전체 요청은 3개 이하로 유지된다.

## Considered Options

- **위젯별 독립 fetch**: 구현이 단순하나 요청 수가 많아 느림. 탈락.
- **단일 `/dashboard` API**: 요청 1개지만 역할별 위젯 변경 시 BE 수정 필수. 결합도 과도. 탈락.
- **하이브리드 (채택)**: 집계성 숫자 카드만 전용 API로 묶고 나머지는 기존 API 재사용.

## Consequences

`GET /dashboard/stats`는 JWT의 role을 읽어 역할별로 다른 필드를 반환한다. FE 타입은 `DashboardStats` union으로 정의하며, 위젯 레지스트리 config가 어떤 필드를 렌더링할지 결정한다.

## 확장 결정 — 선수 상세 Stats Tab (2026-07-20)

선수 상세 페이지의 Stats Tab(Season History / Detail Metrics / Training Records)은 이 ADR의 하이브리드 원칙을 따르되, 대시보드가 아닌 선수 도메인에 귀속된다.

- `GET /players/:id/match-stats` — Season History + Detail Metrics (경기 스탯)
- `GET /players/:id/training-results` — Training Records (훈련 결과)

단일 `/players/:id/stats`로 묶지 않는다. 경기 스탯과 훈련 기록은 도메인이 달라 하나의 엔드포인트가 두 도메인을 처리하면 결합도가 높아진다.

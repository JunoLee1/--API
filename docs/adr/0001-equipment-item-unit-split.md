# Equipment 품목과 개별 아이템을 분리된 두 엔티티로 모델링한다

장비마다 추적 단위가 다르다 — 소모품(볼, 의류 등)은 수량으로 충분하고, 고가 내구재(재활 기기, 전술 장비 등)는 낱개별 상태 추적이 필요하다. 이 두 패턴을 `EquipmentItem`(품목)과 `EquipmentUnit`(개별 아이템)으로 분리하고, `EquipmentItem.trackedIndividually` 플래그로 구분한다. `EquipmentUnit`은 `trackedIndividually = true`인 품목에만 존재한다.

## Considered Options

- **단일 테이블 (수량만)**: 모든 장비를 수량으로 관리. 고가 내구재의 상태 머신(AVAILABLE/IN_USE/MAINTENANCE/RETIRED)을 표현할 수 없어 탈락.
- **단일 테이블 (개별 아이템만)**: 모든 장비에 고유 ID 부여. 스파이크 수십 켤레를 낱개로 관리하는 운영 부담이 과도하여 탈락.
- **혼합 (채택)**: 품목 단위 `EquipmentItem` + 고가 내구재 전용 `EquipmentUnit`. 운영 부담과 추적 정밀도를 함께 확보한다.

## Consequences

`EquipmentAssignment`는 수량 품목 지급 시 `equipmentItemId`를, 개별 아이템 지급 시 `equipmentUnitId`를 참조한다. 둘 중 하나만 채워지는 구조이므로 애플리케이션 레이어에서 일관성 검증이 필요하다.

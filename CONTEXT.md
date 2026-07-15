# 스포츠 ERP — 도메인 용어집

> 이 파일은 구현 스펙이나 설계 문서가 아닙니다. **용어의 의미만** 정의합니다.
> 결정 경위가 필요한 항목은 `docs/adr/` 을 참조하세요.

---

## 시스템 범위

**단일 클럽** 내부 ERP. 리그·타 클럽은 외부 참조 데이터이며 핵심 엔티티가 아니다.

---

## 역할 (Role)

### ADMIN
시스템 운영 전반 담당. 복수 ADMIN 허용.

**사용자 관리 권한:**
- 초대 기반 가입 (자유 가입 없음). 초대 시 역할·코칭역할 미리 지정. Gmail SMTP 이메일 발송. 토큰 유효기간 72시간. 만료 시 재초대(토큰 덮어쓰기)로 처리.
- 역할 변경 가능. 변경 시 진행 중 연관 데이터 경고 표시(차단 아님). COACHING_STAFF 외 역할로 변경 시 coachingRole → null.
- 비활성화(soft delete) / 재활성화.
- 완전 삭제: 연결된 데이터(계약 담당, 훈련 기록, 담당 선수 등)가 없는 경우만 허용.
- 본인 계정 비활성화·삭제 불가.
- 사용자 목록 필터: username 검색, role/coachingRole/isDeleted/nationality 필터.

**초기 ADMIN:** 서버 시작 시 환경변수(`ADMIN_EMAIL`, `ADMIN_PASSWORD`)로 자동 생성. 이미 존재하면 스킵.

### FRONT_OFFICE
프런트 담당자. `frontOfficeRole` 서브 역할로 세분화되며 역할별 접근이 제한된다.

| frontOfficeRole | 연봉 열람 | 계약 생성·수정 |
|----------------|----------|--------------|
| GM (단장) | ✅ | ✅ |
| TD (테크니컬 디렉터) | ✅ | ❌ — 단, Transfer·Prospect 쓰기 가능 |
| CONTRACT_MANAGER (계약 담당) | ❌ | ✅ |
| SCOUT (스카우트) | ❌ | ❌ |
| EQUIPMENT_MANAGER (장비 담당) | ❌ | ❌ |
| TACTICAL_ANALYST (전술 분석관) | ❌ | ❌ |

Recall 승인 권한: GM 전용.

**TACTICAL_ANALYST (전술 분석관):**
경기 데이터 기반 전술 분석 전담. POST_MATCH 분석이 주 업무이며 PRE_MATCH 분석도 작성 가능. CONFIRMED는 HEAD_COACH만 처리한다.
- TacticalAnalysis DRAFT 작성 (PRE_MATCH + POST_MATCH 전체 범위)
- Match·PlayerMatchStats·부상(Injury)·훈련(Training) 전체 열람
- 연봉·계약·이적 열람 불가

### PLAYER
선수 본인. 본인의 훈련 일정 조회, 본인이 출전한 경기의 내용·스탯 조회만 가능.
타 선수 연봉·이적 협상 내용 조회 불가.

### AGENT
선수 에이전트. 담당 선수(복수 가능)의 계약·부상·훈련 출석·경기 스탯 조회 가능.
선수 한 명에 에이전트 한 명 (`Player.agentId → User`). 에이전트 한 명이 복수 선수 담당 가능.
성과 보너스 달성 시 담당 계약 FRONT_OFFICE 직원과 함께 알림 수신.

---

## 코칭스태프 역할 (Coaching Staff Roles)

코칭스태프는 7개 역할로 세분화되며, 각 역할은 담당 영역 외 접근이 제한된다.

### HEAD_COACH (감독)
단독 권한: Recall 요청, 경기 라인업 확정, 훈련 계획 최종 승인, 전술 분석 작성.
모든 코칭 도메인에 접근 가능.

### ASSISTANT_COACH (수석 코치)
HEAD_COACH와 동일한 시스템 권한을 상시 보유한다. "부재 시 대행"은 조직적 의미이며 시스템이 별도로 판단하지 않는다.

### DEFENSIVE_COACH (수비 코치)
담당 영역: 수비 포지션 선수(center_back, wing_back, full_back) 관련 데이터 및 수비 전술 세션 입력.

### ATTACKING_COACH (공격 코치)
담당 영역: 공격 포지션 선수(striker, shadow_striker, winger, attack_midfielder) 관련 데이터 및 공격 전술 세션 입력.

### PHYSICAL_COACH (피지컬 코치)
담당 영역: 신체(Physical) 훈련 도메인 세션.

### SET_PIECE_COACH (세트피스 코치)
담당 영역: 세트피스(Set Piece) 훈련 도메인 세션.

### GOALKEEPER_COACH (골키퍼 코치)
담당 영역: 골키퍼(goalkeeper) 포지션 선수 관련 데이터 + GOALKEEPER SessionType 세션 생성·관리.

### MEDICAL (의료진)
담당 영역: 부상(Injury) 기록 작성·상태 변경 전담. 부상 예방 훈련은 PHYSICAL_COACH 소관이며 MEDICAL 소관이 아니다.

**협진 병원:** 외부 병원 의료진은 시스템 계정을 갖지 않는다. 클럽 MEDICAL이 협진 결과를 대신 입력한다.

### MEDICAL_DIRECTOR (메디컬 관리팀장)
MEDICAL 권한 전체 포함. 추가 권한:
- 선수단 전체 부상 현황 통계 열람 (개별 MEDICAL은 본인이 담당한 케이스 중심)
- REHABILITATION 카테고리 장비 쓰기 권한 (EQUIPMENT_MANAGER와 동일 범위 내 해당 카테고리만)
- 의료비 결재 1차 승인·반려 (SUBMITTED → LEADER_APPROVED / REJECTED)

---

## 핵심 엔티티

### User
시스템 로그인 계정. `role` 필드로 위 역할 중 하나를 가진다.

**가입 흐름:** ADMIN 초대 → 이메일 수신 → 수락 링크에서 비밀번호·username·nickname·phoneNumber·dateOfBirth·nationality 입력 → 계정 생성.

**비밀번호 재설정:** 셀프 서비스. 로그인 화면에서 이메일 입력 → 재설정 링크 발송 → 새 비밀번호 설정. ADMIN 개입 불필요.

### AuditLog (감사 로그)
전체 도메인(계약·이적·부상·훈련·사용자 등) 모든 생성·수정·삭제를 기록.

**필드:** userId, action(CREATE/UPDATE/DELETE), entity(테이블명), entityId, diff(변경 전후 JSON), timestamp

### LoginHistory (로그인 이력)
성공·실패 모두 기록. 실패 시 userId 대신 email로 기록.

**필드:** userId(nullable), email, ip, userAgent, success(boolean), timestamp

### RefreshToken (활성 세션)
발급된 리프레시 토큰을 DB에 저장하여 세션 추적.

**필드:** userId, token(hashed), userAgent, ip, createdAt, expiresAt

**ADMIN 권한:** 특정 사용자의 모든 세션 강제 종료(리프레시 토큰 일괄 삭제). 현재 활성 세션 목록 조회.
**사용자 권한:** 본인의 모든 기기 로그아웃.

### Invite (초대)
ADMIN이 생성하는 일회용 초대 레코드. 이메일당 최신 토큰 하나만 유지(재초대 시 덮어쓰기). 수락 완료 후 삭제.

**필드:** email, role, coachingRole(nullable), token, expiresAt

### Player (선수)
축구 선수 프로필. `User`와 별개 엔티티이며, PLAYER 역할 `User`와 1:1로 연결된다.
계약 만료·이적 후에도 프로필 레코드는 유지된다.

**속성 (발췌):**
- `level`: `YOUTH | ROOKIE | SENIOR | VETERAN` — HEAD_COACH가 전술적 판단으로 수동 설정. 나이·경력 기반 자동 변경 없음.
- `position`: 아래 Position 참조
- `preferredFoot`: left / right / both
- `nationality`: 국적

**생성 권한:** ADMIN, FRONT_OFFICE

**수정 권한 (필드별):**
- 인적사항(playerName·dateOfBirth·nationality·preferredFoot)·agentId·externalId → FRONT_OFFICE
- position·level → HEAD_COACH
- height·weight → PHYSICAL_COACH

**에이전트 배정:** FRONT_OFFICE가 담당. 선수 1명 ↔ 에이전트 1명.

**User ↔ Player 연결·해제:** ADMIN, FRONT_OFFICE 모두 가능.

**상태(PlayerStatus) 전환:** Transfer 생성 시 자동 변경. RETIRED만 수동.
- ACTIVE → ON_LOAN: LOAN_OUT Transfer 생성 시
- ON_LOAN → ACTIVE: 임대 종료 or Recall 승인 시
- ACTIVE → RELEASED: RELEASE Transfer 생성 시
- ACTIVE → RETIRED: 수동 (FRONT_OFFICE)

**LOAN_IN 흐름:** Transfer(LOAN_IN) + Player 프로필을 단일 트랜잭션으로 동시 생성. 임대 종료 시 Player soft delete + 훈련·부상·스탯 데이터 JSON/CSV export 제공. 레코드는 soft delete 후에도 DB에 영구 보존되며 시즌 기록의 일부로 유지된다. export는 상대 클럽에 데이터를 전달하기 위한 것이지 DB 정리 목적이 아니다.

**목록 필터:** 이름 검색, position·level·status·nationality·agentId 필터.

**열람 범위:** 프로필(신체정보·포지션 등)은 전 역할 공개. 연봉·계약 내용은 Contract 도메인에서 별도 제한.

**삭제 정책:** 연결된 데이터(계약·부상·훈련 기록)가 없는 경우만 hard delete. 그 외 status 변경으로 처리.

### Season (시즌)
시작일·종료일로 정의되는 시즌 단위. 스탯·훈련 기록이 시즌에 귀속된다. 계약은 독립적인 날짜 범위(`startDate`/`endDate`)를 가지며 시즌에 귀속되지 않는다.

**생성·관리:** ADMIN 전용.
**동시 활성 시즌:** 1개만 허용 (`status = ACTIVE`인 시즌이 현재 시즌).
**전환:** 수동. ADMIN이 새 시즌 생성 후 이전 시즌을 명시적으로 CLOSED 처리.

### Match (경기)
경기 데이터. 외부 API 자동 인제스트가 기본이며, 수동 입력도 허용.

**메타데이터:** date, opponent, venue(`HOME | AWAY | NEUTRAL`), homeScore, awayScore, competitionType, seasonId, externalId

**competitionType enum:** `LEAGUE | DOMESTIC_CUP | CONTINENTAL | PLAYOFF | FRIENDLY`

**인제스트 흐름:**
- 자동: 매일 cron으로 외부 API 수집
- 수동: FRONT_OFFICE 또는 COACHING_STAFF가 즉시 실행 가능
- 외부 API 미결정 상태 → 어댑터 인터페이스로 추상화, 나중에 교체

**externalId 매핑 실패 시:** 해당 선수 스탯 스킵 + FRONT_OFFICE에 미매핑 선수 목록 알림. `Player.externalId` 연결 후 재처리 가능.

### PlayerMatchStats (경기 선수 스탯)
경기별 선수 수치 데이터 (골·어시스트·패스 정확도·태클 성공률 등). 내부 평가·코멘트는 포함하지 않는다. 선수 본인·AGENT 포함 전 역할 열람 가능 (본인 또는 담당 선수 범위 내).

**competitionType 결정:**
- 자동 인제스트: 외부 API 대회 정보 → 내부 enum 매핑 테이블로 변환
- 수동 입력: FRONT_OFFICE / COACHING_STAFF가 직접 선택

**수동 입력:** FRONT_OFFICE 또는 COACHING_STAFF가 `PlayerMatchStats` 직접 입력 가능. API 장애·미커버 대회 대응.

---

## 포지션 (Position)

세분화된 포지션을 사용하며, 골키퍼 포함.

| 그룹 | 포지션 |
|------|--------|
| 골키퍼 | goalkeeper |
| 공격수 | striker, shadow_striker, winger |
| 공격형 MF | central_attack_midfielder, right_attack_midfielder, left_attack_midfielder |
| 수비형 MF | central_defensive_midfielder, left_defensive_midfielder, right_defensive_midfielder |
| 수비수 | center_back, left_wing_back, left_full_back, right_wing_back, right_full_back |

포지션 그룹은 성과 보너스 트리거 조건을 매핑하는 단위로 사용된다.

---

## 계약 (Contract)

선수와 클럽 간 고용 계약. 선수 한 명에 대해 복수의 계약 이력이 존재할 수 있다.

**필드:**
- `startDate` / `endDate`: 계약 기간
- `salary`: 연봉
- `status`: ACTIVE / EXPIRED / TERMINATED
- `managedById`: 담당 FRONT_OFFICE 직원. 기본값 = 생성자. GM이 이후 변경 가능.
- 옵션 조항 (아래 참조)

**생성·수정 권한:** GM, CONTRACT_MANAGER

**연봉 열람 권한:** ADMIN, GM, TD. PLAYER는 본인 계약만. AGENT는 담당 선수 계약만. 그 외 COACHING_STAFF 열람 불가.

**중간 수정(연봉 인상 등):** 기존 계약을 TERMINATED 처리 후 새 계약 생성. 이력이 Contract 레코드로 누적됨. 새 계약의 `managedById`는 이전 계약의 담당자를 자동 인계한다 (생성자로 초기화하지 않음).

**만료 처리:** 매일 cron으로 `endDate < 오늘`인 ACTIVE 계약을 자동 EXPIRED 전환.

**Recall 승인:** GM 전용.

### 바이아웃 조항 (BuyoutClause)
다른 클럽이 해당 선수를 데려갈 수 있는 조항.

**속성:** `amount`(금액), `validUntil`(행사 가능 기한). 기한 이후에는 조항 효력이 소멸한다.

### 연장 옵션 (ExtensionOption)
특정 조건 충족 시 계약 연장을 행사할 수 있는 조항.

**속성:**
- `extensionPeriod`: 연장 기간
- `conditionText`: 조건 자유 텍스트. 복합 조건(챔피언스리그 진출, 주전 비율 등)을 기록. GM이 수동으로 판단.
- `minAppearances`: 최소 출전 횟수 조건 (nullable). 값이 있으면 시스템이 경기 스탯으로 자동 감지 후 GM에게 알림 발송.

`minAppearances` 조건 달성 또는 GM 수동 판단 시, GM이 계약 개정 흐름(기존 TERMINATE → 신규 생성)으로 처리한다. 시스템이 자동으로 계약을 생성하지 않는다.

### 성과 보너스 (PerformanceBonus)
특정 지표 달성 시 추가 지급되는 보너스. 시스템이 자동 감지하여 FRONT_OFFICE에 알린다.

**집계 기간:** 시즌 단위. 동일 트리거는 같은 시즌에 한 번만 달성 처리된다 (`BonusTriggerAchievement` seasonId 유니크 제약).

**트리거 지표:**
- 팀 성적 (리그 순위, 승수 등)
- 포지션 그룹별 스탯 (골, 어시스트, 패스 정확도, 태클 성공률 등)

> **집계 규칙**: 친선경기(`competitionType = FRIENDLY`) 스탯은 성과 보너스 집계에서 항상 제외한다.
> `BonusTrigger.competitionType = null`(전체 대회)도 FRIENDLY는 포함하지 않는다.

**집계 대상:** LOAN_OUT 중인 선수의 임대 클럽 스탯도 포함. 계약이 우리 클럽에 유효한 한 집계한다.

**자동 감지 시점:** 경기 스탯 인제스트 직후 즉시 + 일간 배치 cron 두 번 실행.

**중복 감지 방지:** `BonusTriggerAchievement(contractId, triggerId, seasonId)` 에 유니크 제약. 감지 시 `ON CONFLICT DO NOTHING` upsert로 처리 — DB가 race condition 없이 중복을 막는다.

**트리거 관리:** `BonusTrigger`는 계약의 일부. 팀 성적 조건도 계약별로 독립 관리된다 — 같은 조건이어도 계약마다 금액이 다를 수 있으므로 공유 엔티티로 분리하지 않는다. 독립 수정 불가 — 변경이 필요하면 계약 개정 흐름(기존 TERMINATE → 신규 Contract 생성)으로만 처리하여 이력을 보존한다.

**달성 기록 열람:** ADMIN, GM, TD + 해당 PLAYER 본인. 금액은 Contract 열람 권한으로 별도 통제.

**달성 후 처리:** 감지 즉시 `ACHIEVED` 상태로 저장 + 알림 발송. 별도 승인 단계 없음. 스탯 원천이 공식 외부 API이므로 자동 확정으로 충분하다.

---

## 영입 후보 (Prospect)

외부 선수 영입 후보. 현재 클럽 미소속이며 SCOUT이 등록·추적한다.

**상태머신:**
```
ACTIVE(추적 중) → MEDICAL_TEST(메디컬 테스트) → CONTRACT_PENDING(계약 협상 중) → SIGNED(계약 성사)
                                                                                ↘ ARCHIVED(결렬·종료)
```
어느 단계에서도 ARCHIVED로 전환 가능 (협상 결렬). 역방향 전환 없음.

**속성:**
- `name`, `nationality`, `position`, `currentTeam`: 기본 신원 정보
- `notes`: SCOUT의 자유 텍스트 분석 메모
- `convertedPlayerId`: SIGNED 시 연결된 Player ID. 스카우팅 이력 추적용.

**쓰기 권한:** SCOUT, GM, TD.
**읽기 권한:** FRONT_OFFICE 전체, HEAD_COACH.

**비자 / 노동허가 추적:**
- `Prospect.visaRequired`: 외국 국적 선수 여부 수동 플래그 (자동 판단 없음 — 이중국적·특례 예외 존재)
- `Prospect.visaEligibility`: `NOT_REQUIRED | CONFIRMED | UNCERTAIN` — CONTRACT_PENDING 진입 전 취득 가능성 사전 확인
- `Player.workPermitStatus`: `NOT_REQUIRED | PENDING | APPROVED | REJECTED` — 계약 성사 후 실제 취득 진행 상황
- `Player.workPermitExpiry`: 노동허가 만료일. 만료 임박 시 FRONT_OFFICE 알림 (TODO)

**SIGNED 전환 흐름:** `POST /prospects/:id/sign` 단일 트랜잭션으로 처리.
1. `Player` 레코드 생성 (name·nationality·position prospect 값 기본 적용, 이후 수정 가능)
2. `Contract` 레코드 생성 (startDate·endDate·salary 입력 필수)
3. `Prospect.status = SIGNED`, `Prospect.convertedPlayerId = 생성된 Player.id`
4. `visaRequired = true`이면 `Player.workPermitStatus = PENDING` 으로 초기화

User 계정 연결은 별도 단계 (ADMIN이 초대 발송 후 선수가 직접 가입).

---

## 장비 (Equipment)

### EquipmentItem (장비 품목)
클럽이 보유한 장비의 종류 단위.

**속성:**
- `name`: 품목명
- `category`: CLOTHING(의류) / FOOTWEAR(신발) / BALL_AND_TOOLS(볼·도구) / REHABILITATION(재활 장비) / TACTICAL(전술 장비) / OTHER(기타)
- `trackedIndividually`: 개별 아이템 단위 추적 여부. `false`이면 수량으로만 관리 (소모품). `true`이면 각 아이템에 고유 ID 부여 (고가 내구재).
- `quantity`: `trackedIndividually = false`인 품목의 현재 재고 수량.
- `lowStockThreshold`: 재고 부족 알림 기준 수량. `quantity`가 이 값 이하로 떨어지면 EQUIPMENT_MANAGER에게 알림 발송.

### EquipmentUnit (개별 장비 아이템)
`trackedIndividually = true`인 품목의 낱개 단위. 고가 내구재에만 존재.

**상태머신:** `AVAILABLE → IN_USE → MAINTENANCE → RETIRED`

### EquipmentAssignment (장비 지급 이력)
선수에게 장비를 지급·반납한 이력.

**속성:**
- `playerId`: 지급 대상 선수
- `equipmentItemId` / `equipmentUnitId`: 수량 관리 품목 또는 개별 아이템 참조
- `issuedAt`: 지급일
- `returnedAt`: 반납일 (null이면 미반납)

**쓰기 권한:** EQUIPMENT_MANAGER, GM.
**읽기 권한:** FRONT_OFFICE 전체, COACHING_STAFF.

---

## 이적 (Transfer)

| 유형 | 의미 |
|------|------|
| PERMANENT | 완전 이적. 이적료 발생. |
| LOAN_OUT | 우리 선수를 타 클럽에 임대. 계약은 우리 클럽 유지. 타 클럽 경기 스탯도 외부 API로 수신하여 계속 추적. |
| LOAN_IN | 타 클럽 선수를 임대 영입. Transfer + Player 레코드를 단일 트랜잭션으로 동시 생성. 임대 종료 시 soft delete 후 데이터 export 제공. |
| FREE | 계약 만료 후 이적. 이적료 없음. |
| RELEASE | 계약 해지(방출). |
| CANCELLED | 협상 결렬·취소. 이력으로 보존. |

**생성·수정 권한:** GM, TD, CONTRACT_MANAGER

**이적료 열람:** ADMIN, GM, TD만 열람 가능. (연봉과 동일 기준)

**LOAN_OUT 자연 만료:** cron으로 `endDate` 도달 시 자동 COMPLETED + Player.status → ACTIVE. FRONT_OFFICE에 알림 발송.

### 임대 조기 복귀 (Recall)

LOAN_OUT 중인 선수를 긴급 복귀시키는 흐름.

```
HEAD_COACH 요청 → GM 최종 승인 → LOAN_OUT 종료 처리 → Player.status → ACTIVE
```

임대 클럽 통보는 FRONT_OFFICE가 시스템 외부에서 처리한다. 이 ERP의 범위 밖이다.

---

## 부상 (Injury)

**상태머신:** `발생 → 진단 → 재활 중 → 복귀 가능 → 복귀`

**필드:**
- `bodyPart`: 부상 부위
- `expectedReturnDate`: 예상 복귀일
- `medicalStaff`: 담당 의료진 (MEDICAL)
- `cause`: TRAINING / MATCH / OTHER

**최초 기록 권한:** COACHING_STAFF 전원 + MEDICAL. 훈련 중 부상은 현장 코치가 즉시 기록 가능.

**상태 전환 권한:**
- 발생 → 진단 → 재활 중 → 복귀 가능: MEDICAL 전담
- 복귀 가능 → 복귀: HEAD_COACH 최종 확정

**복수 부상:** 선수 한 명에 여러 Injury 레코드 동시 ACTIVE 허용. 각 부위별 독립 추적.

**FRONT_OFFICE:** 열람만 가능. 이적·계약 협상 참고용.

`복귀 가능` 전환 시 COACHING_STAFF 전원에 자동 알림.

---

## 훈련 (Training)

### TrainingSession (훈련 세션)

**훈련 계획:**
- `date`: 날짜
- `goal`: 목표
- `sessionType`: 아래 훈련 도메인 참조
- `status`: DRAFT / CONFIRMED

**흐름:** HEAD_COACH가 DRAFT 생성 (전술 목표·경기 일정 기반) → 담당 코치가 세부 내용 입력 → HEAD_COACH가 CONFIRMED(최종 승인·공개). 담당 코치는 DRAFT 상태에서만 편집 가능.

**참가자 (TrainingParticipant):**
- Player 참조 (level, position 포함)

**내용 (TrainingContent):**
- 워밍업, 드릴, 전술, 게임 순서로 구성

**결과 (TrainingResult, 선수별):**
- `attendance`: 해당 세션 담당 코치가 입력
- `feedback`: HEAD_COACH 또는 담당 코치 입력
- `performanceScore`: HEAD_COACH 또는 해당 세션 담당 코치 입력. 담당 코치는 포지션 구분 없이 세션 참가자 전원 평가 가능. `scoredBy(userId)` 필드로 평가자 구분.

**PLAYER 열람:** 본인 출석·점수·피드백 조회 가능. 타 선수 정보 비공개.

### 훈련 도메인 (SessionType)

| 도메인 | 세부 항목 | 담당 코치 |
|--------|-----------|-----------|
| 도메인 | 서브타입 | 담당 코치 |
|--------|----------|-----------|
| 개인 기술 | 패스, 퍼스트 터치, 드리블, 슈팅 | HEAD_COACH |
| 전술 - 수비 | 수비 포지셔닝, 압박, 수비 전환 | DEFENSIVE_COACH |
| 전술 - 공격 | 공격 포지셔닝, 빌드업, 공격 전환 | ATTACKING_COACH |
| 전술 - 전체 | 팀 전체 전술 | HEAD_COACH |
| 신체 | 체력, 민첩성, 부상 예방 | PHYSICAL_COACH |
| 심리·사회 | 팀워크, 역할 명확화, 커뮤니케이션 | HEAD_COACH |
| 세트피스 | 코너킥, 프리킥, 스로인 | SET_PIECE_COACH |
| 골키퍼 | 세이브, 배급, 포지셔닝 | GOALKEEPER_COACH |

### 출석 미달 알림 기준
아래 조건 중 하나라도 충족 시 COACHING_STAFF에 알림:
- 결석 점수(결석수 + 지각수 ÷ 3) ≥ 3 — 지각 3회를 결석 1회로 환산한 통합 기준
- 월 출석률 80% 미만

---

## 전술 분석 (TacticalAnalysis)

경기 전(사전 계획) 또는 경기 후(리뷰) 모두 작성 가능.

**필드:**
- `match`: 연결된 경기 (Match)
- `phase`: PRE_MATCH / POST_MATCH
- `status`: DRAFT / CONFIRMED
- `formation`: 포메이션 (예: 4-3-3)
- `lineup`: 선수 배치도 (포지션 → Player 매핑). PRE_MATCH CONFIRMED = 경기 라인업 확정.
- `opponentAnalysis`: 상대팀 분석 메모 (텍스트)
- `media`: 영상 링크 또는 파일 첨부

**작성 권한:** HEAD_COACH(전체) + 전문 코치(담당 영역) + TACTICAL_ANALYST(전체). DEFENSIVE_COACH는 수비 분석, ATTACKING_COACH는 공격 분석 작성 가능. TACTICAL_ANALYST는 PRE_MATCH + POST_MATCH 전체 범위 DRAFT 작성 가능하며 POST_MATCH 데이터 리뷰가 주 업무다.

**승인 흐름:** 담당 코치 DRAFT 작성 → HEAD_COACH 검토 후 CONFIRMED. CONFIRMED된 분석만 선수에게 공개.

**경기 라인업:** PRE_MATCH 분석 안에 포함. HEAD_COACH가 CONFIRMED 처리 시 라인업 확정.

**PLAYER 열람:** 본인이 출전한 경기의 PRE_MATCH + POST_MATCH 분석 모두 조회 가능 (opponentAnalysis 포함). CONFIRMED 상태에서만 노출된다. 라인업 공개 타이밍은 HEAD_COACH가 CONFIRMED 처리 시점으로 직접 통제한다.

---

## GM 보고서 결재 (Report)

COACHING_STAFF가 작성한 보고서를 GM(FRONT_OFFICE, frontOfficeRole=GM)이 결재하는 워크플로우.

**상태머신:**
```
DRAFT → SUBMITTED → APPROVED
                  ↘ REJECTED → SUBMITTED (재상신)
```

**작성 권한:** COACHING_STAFF 전원 (본인이 작성자).

**결재 권한:** GM.

**필드:**
- `title`: 보고서 제목
- `content`: 본문 (텍스트)
- `fileUrl` / `fileName`: 첨부 파일 (선택, 20MB 제한)
- `submittedAt`: 상신일시
- `reviewedAt`: 결재일시
- `reviewerId`: 결재자 User ID
- `rejectionReason`: 반려 사유

**결재 흐름:**
1. COACHING_STAFF가 DRAFT 저장 (`POST /reports`)
2. COACHING_STAFF가 상신 (`POST /reports/:id/submit`) → SUBMITTED
3. GM이 승인 (`POST /reports/:id/approve`) → APPROVED, 또는 반려 (`POST /reports/:id/reject`, reason 필수) → REJECTED
4. REJECTED 상태에서 재상신 가능. 재상신 시 `rejectionReason` 초기화.

**수정 권한:** 작성자 본인 + DRAFT 또는 REJECTED 상태에서만 가능.

**열람 권한:** 작성자 본인(전체), GM(전체), ADMIN(전체). 그 외 COACHING_STAFF는 본인 작성분만.

---

## 의료비 결재 (MedicalExpense)

MEDICAL 의료진이 신청한 의료비를 MEDICAL_DIRECTOR(1차) → ADMIN(최종) 2단계로 결재하는 워크플로우.

**상태머신:**
```
DRAFT → SUBMITTED → LEADER_APPROVED → APPROVED
                 ↘ REJECTED         ↘ REJECTED
                 (재상신 가능)        (재상신 가능)
```

REJECTED 상태에서 원 신청자가 재상신 가능. 재상신 시 `rejectionReason` 초기화.

**신청 권한:** COACHING_STAFF 중 coachingRole=MEDICAL.

**1차 결재 권한:** COACHING_STAFF 중 coachingRole=MEDICAL_DIRECTOR.

**최종 결재 권한:** ADMIN.

**비용 항목 (ExpenseCostCategory):**
| 값 | 의미 |
|----|------|
| OUTPATIENT | 외래 진료 |
| EXAMINATION | 검사 |
| SURGERY | 수술 |
| REHABILITATION | 재활 |
| MEDICATION | 약제 |

**납부 주체 (ExpensePayerType):**
| 값 | 의미 |
|----|------|
| CLUB | 클럽 부담 |
| ASSOCIATION | 협회 부담 |
| INDIVIDUAL | 개인 부담 |

**필드:**
- `receiptDate`: 영수증 날짜
- `costCategory`: 비용 항목 (위 enum)
- `totalAmount`: 금액
- `payerType`: 납부 주체 (위 enum)
- `description`: 비고 (선택)
- `fileUrl` / `fileName`: 첨부 파일 (영수증 이미지 등, 20MB 제한)
- `submittedAt`, `submittedById`: 상신일시·신청자
- `leaderReviewedAt`, `leaderReviewerId`: 1차 결재일시·결재자
- `adminReviewedAt`, `adminReviewerId`: 최종 결재일시·결재자
- `rejectionReason`: 반려 사유

**열람 권한:** 신청자 본인, MEDICAL_DIRECTOR, ADMIN.

---

## 알림 (Notification)

| 트리거 | 수신자 | 발생 시점 |
|--------|--------|----------|
| 계약 만료 임박 | FRONT_OFFICE | 만료 1년 전, 일간 cron |
| 성과 보너스 달성 | 담당 FRONT_OFFICE + AGENT + 해당 PLAYER | 트리거 달성 감지 즉시 |
| 부상 복귀 가능 | COACHING_STAFF 전원 | Injury → `복귀 가능` 전환 시 |
| 훈련 출석 미달 | COACHING_STAFF | 결석 점수 ≥ 3 (지각 3회 = 결석 1회) / 월 80% 미만 |
| LOAN_OUT 자연 만료 | FRONT_OFFICE | endDate 도달, cron |
| externalId 미매핑 선수 발생 | FRONT_OFFICE | 경기 인제스트 시 |
| 임대 조기 복귀(Recall) 승인 요청 | GM | HEAD_COACH 요청 시 |
| 전술 분석 CONFIRMED 요청 | HEAD_COACH | 작성자가 확정 요청 시 |
| 훈련 세션 CONFIRMED 요청 | HEAD_COACH | 작성자가 확정 요청 시 |
| 장비 재고 부족 | EQUIPMENT_MANAGER | quantity ≤ lowStockThreshold 도달 시 |
| 연장 옵션 행사 가능 | GM | ExtensionOption 조건 달성 시 |
| GM 보고서 상신 | GM | COACHING_STAFF가 보고서 상신 시 |
| GM 보고서 반려 | 보고서 작성자 | GM이 반려 처리 시 |
| 의료비 상신 | MEDICAL_DIRECTOR 전원 | MEDICAL이 의료비 상신 시 |
| 의료비 1차 승인 | ADMIN 전원 | MEDICAL_DIRECTOR가 1차 승인 시 |
| 의료비 반려 | 신청자 본인 | MEDICAL_DIRECTOR 또는 ADMIN이 반려 시 |
| 의료비 최종 승인 | 신청자 본인 | ADMIN이 최종 승인 시 |

**저장 방식:** 수신자별 Notification 레코드 DB 저장. 읽음/안읽음 상태 추적. `/notifications` 목록 페이지 제공.

**발송 채널:** 인앱 전용. 이메일 발송 없음.

**실시간 전달:** 폴링 방식. 클라이언트가 30초마다 `GET /notifications/unread-count` 호출하여 배지 갱신.

**삭제:** 사용자가 개별 삭제 + 전체 삭제 가능. 읽음 처리(단건·전체)도 가능.

**알림 타입 (NotificationType enum):**
```
CONTRACT_EXPIRY
PERFORMANCE_BONUS_ACHIEVED
INJURY_READY_TO_RETURN
TRAINING_ATTENDANCE_WARNING
LOAN_OUT_EXPIRED
PLAYER_EXTERNAL_ID_UNMAPPED
RECALL_APPROVAL_REQUESTED
TACTICAL_ANALYSIS_CONFIRM_REQUESTED
TRAINING_SESSION_CONFIRM_REQUESTED
EQUIPMENT_LOW_STOCK
EXTENSION_OPTION_AVAILABLE
REPORT_SUBMITTED
REPORT_REJECTED
MEDICAL_EXPENSE_SUBMITTED
MEDICAL_EXPENSE_LEADER_APPROVED
MEDICAL_EXPENSE_REJECTED
MEDICAL_EXPENSE_APPROVED
```

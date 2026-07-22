# 스포츠 ERP — 도메인 용어집

> 이 파일은 구현 스펙이나 설계 문서가 아닙니다. **용어의 의미만** 정의합니다.
> 결정 경위가 필요한 항목은 `docs/adr/` 을 참조하세요.

---

## 시스템 범위

**단일 클럽** 내부 ERP. 리그·타 클럽은 외부 참조 데이터이며 핵심 엔티티가 아니다.
클럽 내 복수 팀(성인 1군 + 유소년팀 등)을 지원한다.

### Team (팀)

ADMIN이 생성·관리하는 클럽 내 팀 단위. 팀 구성은 구단마다 다르므로 하드코딩하지 않는다.

**필드:** `name`(팀명), `type`(FIRST_TEAM \| YOUTH), `ageGroup`(U18·U15 등, nullable), `isActive`

**Player ↔ Team:** 단일 소속. `Player.teamId → Team`. 유소년 콜업은 `PlayerCallup` 워크플로우(HEAD_COACH 요청 → GM 승인)를 거쳐 `teamId`를 업데이트하며, 변경 이력은 `AuditLog`로 추적한다.

**COACHING_STAFF ↔ Team:** 단일 소속. `User.teamId → Team`. Player와 동일 원칙.

**Master Policy 전파 (Club Identity Continuity):** 별도 전파 엔티티 없음. 대시보드에서 팀별 TrainingSession SessionType 비율을 집계하여 1군 비율과 비교한다. 추가 입력 없이 기존 훈련 데이터로 자동 계산.

**팀 간 데이터 접근:**
- FRONT_OFFICE (GM·TD 등): 전 팀 열람
- 1군 COACHING_STAFF: 전 팀 열람 (콜업·유망주 모니터링)
- 유소년 COACHING_STAFF: 본인 소속 팀만
- PLAYER: 본인 데이터만 (팀 무관)

**teamId 적용 범위:**
- 직접 부착: `Player`, `TrainingSession`, `Match`, `Coach`
- 간접 연결(Player 경유): `Contract`, `Injury`, `MedicalExpense`
- 간접 연결(Match 경유): `TacticalAnalysis`
- 클럽 전체 공유(teamId 없음): `Equipment`, `Season`

**유소년팀 Match 데이터:** 기존 Match 흐름과 동일. 외부 API 커버 시 자동 인제스트, 미커버 시 수동 입력. 팀 타입별 별도 처리 없음.

**PlayerMatchStats 추적:** `Team.trackStats: boolean`. ADMIN이 팀별로 스탯 추적 여부를 설정. trackStats=false인 팀은 경기 결과·출전 여부만 기록.

**유소년 선수 계약:** `Team.requiresContract: boolean`. ADMIN이 팀별로 정식 Contract 필요 여부를 설정. false인 팀의 Player는 Contract 없이 소속만 관리.

**성과 보너스 팀 범위:** `BonusTrigger.teamScope: ALL | FIRST_TEAM_ONLY`. 계약별로 GM이 설정. LOAN_OUT 선례와 동일하게 계약 조건에 따라 유소년 스탯 포함 여부가 달라진다.

**정렬도 모니터링 대시보드:** 팀별 TrainingSession SessionType 비율을 1군 기준과 비교하여 정렬도 점수(%)를 자동 계산. 열람 권한: 1군 HEAD_COACH, GM, TD, ADMIN.

**유소년 육성 현황 섹션 (기존 TD 대시보드 내 추가):** `Team.type=YOUTH` 팀의 포지션 다양성 지표를 연령대(`Team.ageGroup`)별로 집계. 표시 항목: 팀별 평균 PDI, 단일 포지션 비율 ≥ 80% 선수 목록(편중 경고). 데이터 소스: `LineupSlot` + `PlayerMatchStats.minutesPlayed` 온디맨드 집계. 열람 권한: TD, ADMIN 전용.

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

### GUARDIAN
유소년 선수의 법적 보호자(학부모). `Player.guardianId → User(GUARDIAN)`로 연결.
- 초대 기반 가입 (ADMIN이 입단 신청 처리 중 초대 발송)
- 담당 선수(1명)의 훈련 일정·경기 일정·사고 보고서 수신 전용
- 입단 동의 승인 권한: 본인 자녀 입단 신청(YouthRegistration)에 한함
- 연봉·계약·타 선수 데이터 열람 불가

---

## 코치 (Coach)

`User`와 별개 엔티티. 모든 코칭 역할(HEAD_COACH부터 GK코치까지)을 커버하며, 외부 후보 단계부터 재직·퇴임 후까지 전술 프로필과 이력을 보존한다.
재직 중일 때만 `userId → User(coachingRole)` 로 연결되며, 퇴임 후에도 레코드는 유지된다.
HEAD_COACH 후보는 독립 후보로 등록되며, 패키지 코치진은 해당 HEAD_COACH 후보에 연결된 별도 Coach 후보로 등록된다.

**평가 지표 수집:** 외부 API(API-FOOTBALL 등)에서 코치 후보의 이전 팀 집계 데이터를 자동 수집한다. 수동 입력 없이 객관성을 유지하는 것이 원칙이다.

**역할별 평가 스키마:**
- Tier 1 (독립 스키마): `HEAD_COACH`, `DEFENSIVE_COACH`, `ATTACKING_COACH`, `GOALKEEPER_COACH`
- Tier 2 (공통 경량 스키마): `ASSISTANT_COACH`, `PHYSICAL_COACH`, `SET_PIECE_COACH`

**쓰기 권한:** GM, TD. 최종 승인(APPROVAL_PENDING → CONTRACTED)은 GM 전용.
**읽기 권한:** GM, TD, ADMIN.
SCOUT은 선수(Prospect) 전담이며 Coach 후보에는 접근하지 않는다.

**상태머신:**
```
CANDIDATE → SHORTLISTED → APPROVAL_PENDING → CONTRACTED → RETIRED
                                          ↘
                           ARCHIVED (어느 단계에서든 탈락·결렬 시)
```
역방향 전환 없음. 계약 완료(CONTRACTED) 시 User 계정 생성 후 `userId` 연결.

**SHORTLISTED 전환:** 자동(fitScore ≥ 설정 임계값 시 시스템 전환 + GM 알림)과 수동(GM/TD 직접 전환) 모두 허용.
`shortlistSource: SYSTEM | MANUAL` 필드로 선정 경위를 추적한다. 후보의 알권리 및 내부 감사 근거로 활용.
임계값은 채용 라운드(CoachHiringRound)별로 GM이 설정한다. 동일 포지션이라도 상황에 따라 기준이 달라질 수 있다.

### CoachHiringRound (채용 라운드)

GM이 개설하는 코치 채용 단위. Coach 후보는 `hiringRoundId`로 특정 라운드에 귀속된다.

**필드:** `targetRole`(채용 대상 역할), `fitScoreThreshold`(자동 shortlist 기준), `status`(OPEN \| CLOSED \| CANCELLED), `deadline`(마감일, nullable), `budget`(예산 상한, nullable), `notes`(메모), `createdById`(개설 GM), `result`(결과 요약)

**CONTRACTED 시 User 계정 생성:** 기존 초대 흐름과 동일. CONTRACTED 전환 시 ADMIN에게 알림 발송 → ADMIN이 coachingRole 지정 후 초대 이메일 발송 → 코치 본인이 수락. 합류 시점이 계약 시점과 다를 수 있으므로 ADMIN이 적절한 시점에 초대한다.

### CoachTutorAssignment (튜터 배정)

외국인 코치의 적응 지원을 위한 튜터 배정 단위. 내부(현직 COACHING_STAFF)와 외부(시스템 계정 없는 전문가) 모두 허용. 한 코치에 복수 배정 가능.

**필드:** `type`(INTERNAL \| EXTERNAL), `internalTutorId → User`(INTERNAL 시), `externalName`, `externalContact`(EXTERNAL 시), `sessionCount`(배정 세션 횟수), `coachId → Coach`

**적응도 지표:**
- `languageProficiency`: CEFR 등급(A1 \| A2 \| B1 \| B2 \| C1 \| C2) — 외부 평가 결과 입력
- `tacticalImplementationRate`: 담당 역할 TrainingSession의 참가자 `performanceScore` 집계로 자동 계산 (예: DEFENSIVE_COACH → 수비 세션 선수 평균 점수)

**자동 지원 강도 조정:** 언어 숙련도 ≤ B1 AND 전술 이행률 ≤ 임계값 조건 충족 시 cron이 GM/TD에게 알림 발송 ("세션 증가 권고"). `sessionCount` 직접 변경은 GM/TD가 수동으로 처리한다.

**삭제 정책:** 모든 Coach 레코드는 soft delete만 허용. 탈락 후보(ARCHIVED) 포함 영구 보존. 알권리 대응 및 감사 목적. Player 삭제 정책과 동일 원칙.

---

**알림 트리거 (Coach 도메인):**

| 트리거 | 수신자 | 발생 시점 |
|--------|--------|----------|
| fitScore ≥ 임계값 달성 | GM | API 데이터 수집 후 자동 계산 시 |
| SHORTLISTED 수동 전환 | TD | GM이 직접 전환 시 |
| APPROVAL_PENDING 전환 | GM | TD가 승인 요청 시 |
| CONTRACTED 전환 | ADMIN | GM 최종 승인 시 (계정 생성 필요 안내) |
| HEAD_COACH CONTRACTED | GM, TD | Master Policy 갱신 안내 |
| Coach ARCHIVED | 해당 라운드 GM | 어느 단계에서든 탈락 처리 시 |

**패키지 연결:** 패키지 코치는 `packageLeadId → Coach(HEAD_COACH 후보)`로 연결된다. 한 코치는 하나의 패키지에만 속한다.

**Master Policy (구단 전술 가이드라인):** 별도 엔티티 없음. 현직 HEAD_COACH의 평가 데이터(`HeadCoachEvaluation`)가 곧 구단의 기준 모델이다. 감독 교체 시 새 HEAD_COACH의 평가 데이터로 자동 대체된다.

**역할별 평가 지표 (팀 집계 기준, 외부 API 수집):**
- `HeadCoachEvaluation`: 점유율, 압박 강도, 전진패스 성공률, 활동량, 구단 철학 부합도 점수(API 유사도)
- `DefensiveCoachEvaluation`: 태클 성공률, 클리어, 블록, 수비 실책, 볼 리커버리, 압박
- `AttackingCoachEvaluation`: xG, xA, 찬스 메이킹, 드리블 성공률, 전진패스 성공률, 샷 전환율, 득점 관여율
- `GoalkeeperCoachEvaluation`: PSxG, xG 대비 실점, 빌드업 패스 성공률
- Tier 2 공통: `fitScore`(0–100), `notes`(자유 텍스트)

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
- `playStyle: PlayStyleEnum?` — HEAD_COACH 수동 설정. 알고리즘이 `PlayerMatchStats` 집계로 초기값 제안 후 HEAD_COACH가 확정·수정. 통계 데이터 부족 시(신인 등) null 허용. **고정 Prisma enum** — 변경 시 마이그레이션 필요하나 레이더 차트 비교 일관성을 위해 채택. 초기 enum 값 목록은 구현 시 확정.

**시장 가치 (MarketValue):**
- `Player.currentMarketValue: Float?` — 현재 시장 가치. 현재는 TD/SCOUT 수동 입력, 향후 외부 API(어댑터 패턴)로 교체 예정.
- `MarketValueHistory` 별도 엔티티 — 시점별 가치 이력. 감가 상각 추이 조회에 사용.
  - 필드: `playerId → Player`, `value: Float`, `recordedAt: DateTime`, `recordedById → User`, `source: MANUAL | EXTERNAL_API`
  - **스냅샷 트리거:** ① 수동 업데이트 시 즉시 생성 + ② 월 1회 cron 정기 스냅샷 (`source: EXTERNAL_API`로 전환 후에도 동일 패턴 유지)
- **열람 권한:** GM, TD, ADMIN 전용 (이적료와 동일 기준). PLAYER 본인 포함 그 외 역할 비공개.
- **쓰기 권한:** TD, SCOUT (수동 입력 단계 기준).

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

> **타입 수정 필요:** `Player_match_stats.xG`, `Player_match_stats.xA`가 스키마에 `Int?`로 선언되어 있으나 Expected Goals는 소수값이므로 `Float?`로 마이그레이션 필요.

**competitionType enum:** `LEAGUE | DOMESTIC_CUP | CONTINENTAL | PLAYOFF | FRIENDLY`

**인제스트 흐름:**
- 자동: 매일 cron으로 외부 API 수집
- 수동: FRONT_OFFICE 또는 COACHING_STAFF가 즉시 실행 가능
- 외부 API 미결정 상태 → 어댑터 인터페이스로 추상화, 나중에 교체

**externalId 매핑 실패 시:** 해당 선수 스탯 스킵 + FRONT_OFFICE에 미매핑 선수 목록 알림. `Player.externalId` 연결 후 재처리 가능.

### PlayerMatchStats (경기 선수 스탯)
경기별 선수 수치 데이터 (골·어시스트·패스 정확도·태클 성공률 등). 내부 평가·코멘트는 포함하지 않는다. 선수 본인·AGENT 포함 전 역할 열람 가능 (본인 또는 담당 선수 범위 내).

**Position Diversity Index (유소년 전용):** `LineupSlot.slotKey` → Position 매핑 + `PlayerMatchStats.minutesPlayed`를 온디맨드 집계하여 포지션별 출전 시간 비율을 반환. 별도 테이블 없음. 훈련 포지션 추적은 미지원(TrainingParticipant에 positionAssigned 없음). `GET /players/:id/position-diversity` 엔드포인트로 제공. `Team.type !== 'YOUTH'`인 선수는 빈 응답.

> **타입 수정 필요:** `xG`, `xA` → `Float?` 마이그레이션 필요 (현재 `Int?`로 잘못 선언).
> **필드 추가 필요:** `aerial_duel_success_rate: Float?` (수비수 레이더 차트 공중볼 축).

**레이더 차트 축 정의 (포지션 그룹별, 각 6축):**

| 그룹 | 축 | 스키마 필드 |
|------|----|------------|
| **공격수** (striker·shadow_striker·winger·*AM) | 득점력 | `xG`, `goals` |
| | 찬스 메이킹 | `xA`, `assist` |
| | 드리블/활동량 | `sprint` |
| | 슈팅 정확도 | `clear_cut_chance_rate` |
| | 패스 | `passing_accuracy` |
| | 세트피스 | `penalty_conversion_rate`, `free_kick_conversion_rate` |
| **미드필더** (CDM·CM·CAM) | 패스 | `passing_accuracy` |
| | 기회창출 | `xA`, `assist` |
| | 수비 기여 | `tackle_success_rate`, `interception` |
| | 활동량 | `sprint` |
| | 득점 관여 | `xG`, `goals` |
| | 세트피스 | `free_kick_conversion_rate` |
| **수비수** (CB·WB·FB) | 태클 | `tackle_success_rate` |
| | 인터셉트 | `interception` |
| | 클리어런스 | `clearance` |
| | 공중볼 | `aerial_duel_success_rate` *(신규 필드)* |
| | 빌드업 패스 | `passing_accuracy` |
| | 활동량 | `sprint` |
| **골키퍼** | 세이브율 | `shots_on_target - shot_allowed` 역산 |
| | 빌드업 패스 | `passing_accuracy` |
| | 크로스 처리 | `crosses_completed` |
| | 슈팅 방어 | `shot_blocked` |
| | 실점 방어 | `shot_allowed` |
| | 킥 배급 | `free_kick_conversion_rate` |

**강점/약점 태그 판정 알고리즘:**
- **강점** = 해당 축 점수 ≥ 70 **AND** 팀 내 동일 포지션 그룹 상위 25%
- **약점** = 해당 축 점수 ≤ 40 **OR** 팀 내 동일 포지션 그룹 하위 25%
- **표본 부족 (동일 포지션 그룹 3명 미만):** 상대 비교 비활성화, 절대 임계값만 적용, 태그 미표시 처리 가능.

**competitionType 결정:**
- 자동 인제스트: 외부 API 대회 정보 → 내부 enum 매핑 테이블로 변환
- 수동 입력: FRONT_OFFICE / COACHING_STAFF가 직접 선택

**수동 입력:** FRONT_OFFICE 또는 COACHING_STAFF가 `PlayerMatchStats` 직접 입력 가능. API 장애·미커버 대회 대응.

### MatchLineup / LineupSlot (경기 라인업)

COACHING_STAFF 또는 HEAD_COACH가 경기별 포메이션·선발·후보 라인업을 드래그앤드롭으로 구성하고, HEAD_COACH가 최종 확정하는 기능. `MatchSquad`(참여 명단)와 별도로 관리되는 전용 테이블.

**MatchLineup 필드:** `matchId`(@unique), `formation`, `isConfirmed`, `confirmedAt`, `confirmedById`

**LineupSlot 필드:** `lineupId`, `playerId`, `slotKey`, `isStarter`
- `slotKey`: FORMATION_LAYOUTS 포지션 키 (예: "GK", "CB1", "LW")
- 후보(`isStarter=false`)는 `"BENCH_0"`, `"BENCH_1"` 등

**접근 권한:**

| 역할 | 조회 | 편집·저장 | 확정 |
|------|------|-----------|------|
| PLAYER / FRONT_OFFICE | ✅ | ❌ | ❌ |
| COACHING_STAFF | ✅ | ✅ | ❌ |
| HEAD_COACH / ADMIN | ✅ | ✅ | ✅ |

**저장 방식:** `PUT /matches/:id/lineup` — 트랜잭션으로 기존 슬롯 전체 삭제 후 재생성(replace). `isConfirmed`는 저장으로 초기화되지 않음.

**미등록 경기 대응:** `MatchLineup`이 없고 `MatchSquad`가 있는 경기 → GET 시 스쿼드 선수를 후보 슬롯으로 채운 초안 반환(미저장 상태). 저장 시 비로소 `MatchLineup` 생성.

**확정 시 알림:** HEAD_COACH 확정 후 라인업 내 각 선수(`userId` 보유)에게 선발/후보 구분하여 `LINEUP_CONFIRMED` 알림 발송.

**포지션 Mismatch 경고 (FIRST_TEAM 전용):** FE에서 `slotDef.position !== player.position`일 때 슬롯에 ⚠ 배지 표시. 저장은 차단하지 않는다(비차단 경고). `Team.type === 'YOUTH'`이면 배지를 렌더링하지 않는다. BE는 포지션 유효성을 검증하지 않는다.

**선수 앱 노출:** `isConfirmed=true`인 경우에만 노출.

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

## 등번호 (JerseyNumber)

팀별로 독립 관리되는 등번호 단위. 선수와 독립적으로 존재하며, 은퇴 번호(`Retired`) 및 영입 후보 예약(`Reserved`) 개념을 지원하기 위해 별도 엔티티로 분리한다.

**필드:**
- `number: Int` — 등번호
- `teamId → Team` — 팀별 독립 관리 (1군 7번 ≠ 유소년 7번)
- `status: AVAILABLE | OCCUPIED | RETIRED | RESERVED` — 아래 상태 설명 참조
- `playerId? → Player` — OCCUPIED 시 연결
- `prospectId? → Prospect` — RESERVED 시 영입 후보 연결 (nullable)

**유니크 제약:** `@@unique([number, teamId])`

**상태 의미:**
- `AVAILABLE`: 사용 가능
- `OCCUPIED`: 현재 선수가 착용 중
- `RETIRED`: 영구 결번 (선수 없음)
- `RESERVED`: 특정 영입 후보를 위해 예약됨

**쓰기 권한:**
- `RETIRED` 설정: GM 전용
- `RESERVED` 설정 (영입 후보 예약): GM 전용
- `OCCUPIED` 전환 (선수 배정): GM + ADMIN (충돌 워크플로우 참조)
- `AVAILABLE` 복원: GM + ADMIN

**충돌 워크플로우:**
- `OCCUPIED` 번호 배정 시도: 시스템 차단. 기존 선수 번호 해제(→ AVAILABLE) 후 재배정 2단계 강제.
- `RESERVED` 번호 배정 시도: 예약 해제 또는 동일 GM이 직접 배정하는 경우만 허용.
- `RETIRED` 번호 재활성화: **ADMIN 전용 override**. GM 포함 그 외 역할 불가.

**알림:** 충돌 시도 시 요청자에게 인앱 알림 발송.

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

### 유소년 입단 신청 (YouthRegistration)

유소년 선수가 팀에 합류하기 위한 승인 워크플로우. 학부모 동의가 확보되기 전까지 `Player` 레코드를 생성하지 않는다.

**상태머신:**
```
PENDING → GUARDIAN_APPROVED → CONTRACTED
        ↘ REJECTED
```

**필드:** `playerName`, `birthDate`, `preferredJerseyNumber`, `teamId → Team(YOUTH)`, `guardianId → User(GUARDIAN)`(승인 후 연결), `status`, `requestedById → User(ADMIN)`, `createdAt`, `updatedAt`

**흐름:** ADMIN 입단 신청 생성 + GUARDIAN 초대 발송 → GUARDIAN 앱 내 동의 승인(GUARDIAN_APPROVED) → ADMIN 계약 체결 처리(CONTRACTED) → `Player` 레코드 + `Player.guardianId` 동시 생성. 거절 시 REJECTED.

**선호 등번호:** `YouthRegistration.preferredJerseyNumber`에 보관. CONTRACTED 전환 시 해당 팀의 JerseyNumber 가용 여부 확인 후 배정(불가 시 ADMIN 알림).

---

### 유소년 콜업 (PlayerCallup)

유소년 선수를 1군으로 임시 합류시키는 워크플로우. `teamId` 직접 변경이 아닌 승인 흐름을 거친다.

**상태머신:**
```
REQUESTED → APPROVED → ACTIVE (teamId 업데이트)
           ↘ REJECTED
```

**필드:** `playerId → Player`, `fromTeamId → Team`(출신 유소년 팀), `toTeamId → Team`(1군), `requestedById → User`(HEAD_COACH), `approvedById → User`(GM), `reason`(콜업 사유), `status`(REQUESTED \| APPROVED \| REJECTED \| COMPLETED), `startDate`, `endDate`(nullable — 미지정 시 영구 이적으로 간주)

**흐름:** HEAD_COACH 요청 → GM 승인 → `Player.teamId` 자동 업데이트 + `AuditLog` 기록. 거절 시 `reason` 필수.

**완료(COMPLETED):** `endDate` 도래 시 HEAD_COACH 또는 GM이 수동으로 COMPLETED 처리. `Player.teamId` 원복은 수동. 자동 복귀 없음.

---

## 사고 보고서 (IncidentReport)

유소년 전용. 훈련·경기 중 사고 발생 시 코치가 작성하고 학부모(GUARDIAN)에게 자동 알림을 발송하는 워크플로우. 의료 상태 추적(Injury)과 분리된 현장 기록 엔티티.

**상태머신:**
```
DRAFT → SUBMITTED → SIGNED
```

**필드:** `playerId → Player`, `teamId → Team(YOUTH)`, `type: MATCH | TRAINING`, `matchId? → Match`, `sessionId? → TrainingSession`, `description`(육하원칙), `reportedById → User(COACHING_STAFF)`, `supervisorSigned: boolean`, `medicalSigned: boolean`, `injuryId? → Injury`(후속 부상 연결 시), `status`

**흐름:**
- DRAFT → SUBMITTED: 코치 제출 시 GUARDIAN에게 인앱 알림 자동 발송
- SUBMITTED → SIGNED: 감독·의무팀 양측 서명 완료 시 → 공기관 외부 보고서 생성 트리거

**Injury 연결:** 경미한 사고는 `injuryId` 없이 독립 존재 가능. 의무팀이 진찰 후 `Injury` 생성 시 `incidentReportId`로 역참조.

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

**ExternalReport 연결:** `ExternalReport.injuryId`는 optional로 전환. `ExternalReport.incidentReportId? → IncidentReport` 추가. `injuryId`와 `incidentReportId` 중 하나는 반드시 존재해야 한다(DB CHECK 제약 또는 서비스 레이어 보장). 기존 성인 Injury 흐름은 변경 없음.

---

## 훈련 (Training)

### TrainingVideo (훈련 영상)

클럽 전체 공유 영상 자산. `teamId` 없음 — 어느 팀 코치든 업로드·열람 가능.

**필드:** `title`, `url`(영상 링크 또는 스토리지 경로), `tags`(전술 키워드 배열), `sessionType`(nullable, 관련 SessionType), `uploadedById → User`, `createdAt`

**열람 권한:** COACHING_STAFF 전원, HEAD_COACH, GM, ADMIN. PLAYER는 `VideoAssignment`를 통해 할당된 영상만 열람.

### VideoAssignment (영상 과제 할당)

특정 선수에게 `TrainingVideo`를 과제로 할당하는 단위.

**필드:** `videoId → TrainingVideo`, `playerId → Player`, `assignedById → User`, `dueDate`(nullable), `progressRate`(0–100, 선수 본인 업데이트), `note`(할당 사유·지시사항)

**알림:** 할당 시 해당 선수에게 알림 발송. `dueDate` 초과 시 담당 코치에게 알림.

**체화도 연결:** `progressRate` 100% 달성 후 해당 선수의 다음 `TrainingResult.performanceScore`가 코치 판단의 참고 지표로 활용된다. 자동 반영은 없음 — 코치가 직접 평가.

**Player Motivation Design (PLAYER 본인 전용 뷰):**
세 가지 레이어를 함께 표시한다.
- **(A) 훈련-경기 상관관계:** 최근 `TrainingResult.performanceScore` 추세와 경기 스탯 추세를 같은 차트에 겹쳐 표시. 훈련 노력이 경기 성과로 이어지는 것을 시각화.
- **(B) 훈련 성실도 요약:** 출석률·`VideoAssignment` 완료율 숫자 카드. "이번 달 훈련 참여율 92%" 형태.
- **(C) 시즌 평균 대비 현재 폼:** 최근 N경기 축별 평균 vs 해당 시즌 전체 평균. 레이더 차트 오버레이 또는 별도 폼 카드로 "시즌 평균 대비 ±%" 표시.

타 역할(코치·FRONT_OFFICE 등)의 선수 상세 페이지에서는 노출하지 않는다.

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
- `performanceScore`: 최종 1–10 합산 점수. HEAD_COACH 또는 해당 세션 담당 코치 입력. 담당 코치는 포지션 구분 없이 세션 참가자 전원 평가 가능. `technicalScore`, `tacticalScore`, `physicalScore` 서브스코어를 SessionType별 가중치로 합산하여 앱 레이어에서 계산하거나, 코치가 직접 입력할 수 있다.
- `technicalScore`: 기술적 서브스코어 (nullable). 패스 성공률·볼 점유 효율·의사결정 속도 기준.
- `tacticalScore`: 전술적 서브스코어 (nullable). 압박 트리거 반응률·공간 점유율·전환 시 복귀 시간 기준.
- `physicalScore`: 피지컬 서브스코어 (nullable). HSR·가속/감속 횟수·RPE 기준.

**서브스코어 가중치:** SessionType별 w₁(기술)·w₂(전술)·w₃(피지컬) 가중치는 코드/환경변수 고정값. DB에 저장하지 않으며 변경 시 배포가 필요하다.
- `scoredById → User`: 평가자 기록. 감사 및 평가자별 추적 목적.

**PLAYER 열람:** 본인 출석·점수·피드백 조회 가능. 타 선수 정보 비공개.

**선수 상세 페이지 — PLAYER 본인 뷰 공개 범위:**

| 컴포넌트 | PLAYER 본인 공개 여부 |
|----------|----------------------|
| 레이더 차트 (강점/약점 태그) | ✅ |
| `playStyle` 라벨 | ✅ (동기 부여 목적) |
| `Contract.salary` (본인 계약) | ✅ |
| `TrainingResult` (출석·점수·피드백) | ✅ |
| `PlayerDevelopmentPlan` | ✅ (ACTIVE 이후) |
| `TacticalAnalysis` | ✅ (CONFIRMED만) |
| `Transfer.fee` 이적료 | ❌ |
| `MarketValue` / `MarketValueHistory` | ❌ |
| 타 선수 데이터 일체 | ❌ |

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

### CoachAvailability (코치 가용성)

코치의 날짜별 불가 일정 블록. HEAD_COACH가 훈련을 계획할 때 담당 코치 가용성을 확인하는 용도.

**필드:** `userId → User`, `startDate`, `endDate`, `reason?(메모)`, `createdById → User`

**입력 권한:** 본인, ADMIN, HEAD_COACH.

**훈련 세션 연동:** 세션 생성 시 해당 날짜 불가 코치를 경고 표시. 차단 없음 — HEAD_COACH가 최종 판단.

### PlayerDevelopmentPlan (선수 발전 계획)

코치가 특정 선수에 대해 시즌 단위로 작성하는 공식 발전 목표 문서.

**필드:** `playerId → Player`, `coachId → User(작성자)`, `seasonId → Season`, `goals(목표 자유 텍스트)`, `notes?(메모)`, `status(DRAFT|ACTIVE|REVIEWED)`, `reviewedAt?`

**상태머신:** `DRAFT → ACTIVE → REVIEWED`. 선수는 ACTIVE 이후부터 열람 가능.

**제약:** `@@unique([playerId, seasonId])` — 선수 × 시즌당 1개. 공동 편집 가능하며 마지막 수정자가 `coachId`에 기록.

**쓰기 권한:** HEAD_COACH, 담당 포지션 코치.

**읽기 권한:** 작성자, HEAD_COACH, GM, TD, ADMIN + 해당 선수 본인(ACTIVE 이후).

### TrainingReference (훈련 레퍼런스)

훈련 관련 외부 자료(영상·문서 링크) 및 세션 추천의 관리 단위.

**필드:** `sessionType`(연결 SessionType), `title`, `url`(외부 링크), `source`(INTERNAL \| EXTERNAL), `tags`(태그 배열), `addedById → User`

**세션 자동 추천:** 동일 `sessionType` 내에서 `TrainingResult.performanceScore` 평균 상위 N개 세션을 추천. 세션 유형이 다른 세션 간 비교는 하지 않는다.

**태그 기반 검색:** `tags` 필드로 수비조직·압박·빌드업 등 전술 키워드 필터링.

### TrainingLoad (훈련 부하)

세션별 선수 부하 기록. PHYSICAL_COACH의 핵심 관리 지표.

**필드:** `playerId → Player`, `sessionId → TrainingSession`, `rpe(Int 1–10, 선수 본인 입력)`, `load(Int, PHYSICAL_COACH 입력)`

**주간 부하 알림:** 선수 주간 누적 `load` 합계가 팀 전체 고정 임계값 초과 시 PHYSICAL_COACH + HEAD_COACH에게 알림. 임계값은 서버 설정값(환경변수 또는 시스템 설정)으로 관리.

### 출석 미달 알림 기준
아래 조건 중 하나라도 충족 시 COACHING_STAFF에 알림:
- 결석 점수(결석수 + 지각수 ÷ 3) ≥ 3 — 지각 3회를 결석 1회로 환산한 통합 기준
- 월 출석률 80% 미만

### 출석 데이터 수동 정정

비정상 출석 데이터(예: 지각 17회인데 출석률 33% 산출) 발생 시 ADMIN만 원본 로그를 정정할 수 있다. 담당 코치는 정정 불가.

**정정 조건:** 정정 시 `AuditLog`에 `before`(정정 전 값), `after`(정정 후 값), `reason`(정정 사유 텍스트)을 필수 기록. 사유 없는 정정은 시스템이 거부한다.

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

**경기 라인업:** 별도 `MatchLineup` 테이블로 관리 (→ MatchLineup / LineupSlot 섹션 참조). 전술 분석의 `lineup` JSON 필드는 전술 메모 용도로 유지.

**PLAYER 열람:** 본인이 출전한 경기의 PRE_MATCH + POST_MATCH 분석 모두 조회 가능 (opponentAnalysis 포함). CONFIRMED 상태에서만 노출된다. 라인업 공개 타이밍은 HEAD_COACH가 CONFIRMED 처리 시점으로 직접 통제한다.

---

## 보고서 결재 (Report)

COACHING_STAFF가 작성한 보고서를 결재하는 워크플로우. 보고서 유형(`reportType`)에 따라 결재권자가 다르다.

**reportType:**
- `TRAINING`: 훈련 관련 보고서 — HEAD_COACH가 결재.
- `OPERATIONS`: 계약·운영·기타 보고서 — GM이 결재.

**상태머신:**
```
DRAFT → SUBMITTED → APPROVED
                  ↘ REJECTED → SUBMITTED (재상신)
```

**작성 권한:** COACHING_STAFF 전원 (본인이 작성자).

**결재 권한:** `reportType`이 TRAINING이면 HEAD_COACH, OPERATIONS이면 GM.

**필드:**
- `reportType`: TRAINING \| OPERATIONS
- `title`: 보고서 제목
- `content`: 본문 (텍스트)
- `fileUrl` / `fileName`: 첨부 파일 (선택, 20MB 제한)
- `submittedAt`: 상신일시
- `reviewedAt`: 결재일시
- `reviewerId → User`: 결재자 (HEAD_COACH 또는 GM)
- `rejectionReason`: 반려 사유

**결재 흐름:**
1. COACHING_STAFF가 DRAFT 저장
2. COACHING_STAFF가 상신 → SUBMITTED
3. 해당 결재권자가 승인 → APPROVED, 또는 반려(사유 필수) → REJECTED
4. REJECTED 상태에서 재상신 가능. 재상신 시 `rejectionReason` 초기화.

**수정 권한:** 작성자 본인 + DRAFT 또는 REJECTED 상태에서만 가능.

**열람 권한:** 작성자 본인(전체), HEAD_COACH(TRAINING 유형 전체), GM(OPERATIONS 유형 전체), ADMIN(전체). 그 외 COACHING_STAFF는 본인 작성분만.

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
| 훈련 부하 초과 | PHYSICAL_COACH, HEAD_COACH | 선수 주간 누적 load ≥ 임계값 시 |
| PDP 활성화 | 해당 선수 본인 | PDP status → ACTIVE 전환 시 |
| 라인업 확정 | 라인업 내 선수 전원 (userId 보유자) | HEAD_COACH가 라인업 확정 시 |
| 경기 D-1 알림 | GUARDIAN (자녀 소속 팀 경기) | 경기 전날 cron (`MATCH_DAY_REMINDER` 수신자 확장) |
| 주간 훈련·경기 일정 | GUARDIAN (자녀 소속 팀) | 매주 월요일 아침 cron (`YOUTH_WEEKLY_SCHEDULE`) |
| 훈련 세션 변경·취소 | GUARDIAN (자녀 소속 팀) | TrainingSession 시간 변경 또는 취소 처리 시 (`YOUTH_SESSION_CHANGED`) |
| 사고 보고서 제출 | GUARDIAN (해당 자녀) | IncidentReport → SUBMITTED 전환 시 (`INCIDENT_REPORT_SUBMITTED`) |
| 입단 신청 상태 변경 | GUARDIAN (해당 신청 건) | YouthRegistration 상태 전환 시 (`YOUTH_REGISTRATION_STATUS_CHANGED`) |
| 1군 콜업 요청 | GUARDIAN (해당 자녀) | PlayerCallup REQUESTED 시 (`CALLUP_REQUESTED` 수신자 확장) |

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
TRAINING_LOAD_ALERT
PLAYER_DEVELOPMENT_PLAN_ACTIVATED
LINEUP_CONFIRMED
```

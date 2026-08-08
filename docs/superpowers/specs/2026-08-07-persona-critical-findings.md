# FC Seoul ERP — 페르소나 Critical 피드백 종합

> 작성일: 2026-08-07  
> 세션: feat/kpi-drilldown 브랜치 기준  
> 방법: 페르소나별 에이전트 독립 코드 리뷰

---

## 페르소나 목록

| # | 페르소나 | 역할 | 담당 섹션 | Critical 수 |
|---|----------|------|-----------|-------------|
| 1 | **Steve** | HR 담당자 (한국, 5년차) | HR 보고서·인사관리 | 5 |
| 2 | **이연주** | K리그 HR팀장 (한국, 5년차, 빡센) | HR 보고서·인사관리 | 5 |
| 3 | **Rooney** | FC Seoul 구단주 (영국, ROI 중시) | 선수계약·선수관리 | 5 |
| 4 | **David Park** | 구단 관리자 (한국계 영국, 맨유 10년) | 선수계약·선수관리 | 5 |
| 5 | **Jack** | 재무팀장 (영국, 5년차, 감사 기준 높음) | 재무 보고서 관리 | 10 |
| 6 | **이영표** | Technical Director (한국, 10년차, 완전 T형) | 전술·훈련 데이터 | 20 |
| 7 | **Megan** | 의무팀장 (영국, 첼시 15년차) | 부상관리·재활·의료비 | 20 |
| 8 | **Kane** | Technical Director (영국, 15년차) | 선수 컨디셔닝·훈련 부하 | 10 |
| 9 | **박희수** | 의무팀 (한국, 15년차) | 선수 컨디셔닝·훈련 부하 | 10 |
| 10 | **빠뜨롱** | 자산관리사 (한국, 15년차, 완전 T형) | 스폰서십·파트너십 | 20 |
| 11 | **김동욱** | 시설관리팀장 (한국, 18년차) | 시설 관리·장비 관리 | 10 |
| 12 | **Trevor** | Stadium Operations Manager (영국, 14년차) | 시설 관리·장비 관리 | 10 |
| 13 | **서지혜** | 채용팀장 (한국, 11년차) | 채용·인재 파이프라인 | 10 |
| 14 | **Claire** | Talent Acquisition Director (영국, 9년차) | 채용·인재 파이프라인 | 10 |
| 15 | **박성준** | 팬서비스팀장 (한국, 8년차) | 팬 운영·티켓 | 10 |
| 16 | **Jordan** | Head of Ticketing & Fan Engagement (영국, 16년차) | 팬 운영·티켓 | 10 |
| 17 | **이상훈** | IT보안팀장 (한국, 13년차) | IT·데이터 보안 | 10 |
| 18 | **Rachel** | Head of Information Security (영국, 11년차) | IT·데이터 보안 | 10 |

---

## 섹션 1: HR 보고서 · 인사관리

### Steve (HR 담당자) — 5 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| S1 | 출결 정정 후 기존 페널티 자동 해제 없음 | `TrainingResultsPage.tsx:47` | 정정으로 결석→출석 바꿔도 이미 발동된 페널티 레코드 잔존 |
| S2 | 채용 공고 필요인원 충원 여부 추적 불가 | `JobPostingListPage.tsx:30` | headcount 대비 HIRED 수 집계 없어 채용 완료 여부 불명 |
| S3 | 인터뷰 일정 변경 시 지원자 알림 없음 | `ApplicationDetailPage.tsx:117` | `scheduleInterview()`/`updateInterview()` 후 notification 발송 로직 없음 |
| S4 | 세션별 출결 미등록 선수 현황 조회 불가 | `TrainingResultsPage.tsx:164` | "20명 중 3명 미입력" 뷰 없음, 전체 테이블 수동 스캔만 가능 |
| S5 | 스태프 Active 상태 ≠ 실제 고용 기간 | `StaffRecordPage.tsx:23` | 고용 시작/종료일 필드 없어 퇴직 후에도 isActive 수동 관리 |

### 이연주 (K리그 HR팀장) — 5 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| Y1 | 공지 미열람 드릴다운에 공지 내용·대상 컨텍스트 없음 | `ops-report.service.ts:149` | userId·name·unreadCount만 반환, 어떤 공지를 누구에게 안 읽혔는지 불명 |
| Y2 | 출결 정정 감사 로그 저장되지만 UI 조회 불가 | `training.service.ts:157` | `writeAuditLog(reason)` 쌓이지만 프론트에 정정 이력 뷰 없음 |
| Y3 | KPI 드릴다운 항목에 팀·포지션·계약 컨텍스트 없음 | `ops-report.ts:29` | `AttendanceDrillItem`에 소속팀/포지션 없어 다음 액션 결정 불가 |
| Y4 | 연봉 분포 차트에 개별 선수 드릴다운 없음 | `HrReportPage.tsx:202` | "5억 이상 구간 2명" 표시되지만 누구인지 클릭 불가 |
| Y5 | 훈련 출결 페널티 ↔ HR 보고서 연동 끊김 | `training.service.ts:11` | 페널티 발동 로직 있으나 HrReportPage에 출석 페널티 누적 항목 없음 |

---

## 섹션 2: 선수계약 · 선수관리

### Rooney (구단주) — 5 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| R1 | 스쿼드 전체 임금 총액·ROI 대시보드 없음 | `ContractsPage.tsx:125` | 선수별 조회만 가능, 전체 임금 합계·포지션별 분포 집계 없음 |
| R2 | 선수 자산 가치 vs 계약 잔존기간 연계 없음 | `PlayerDetailPage.tsx:156` | 시장가치와 계약 만료일 분리, 재계약 레버리지 데이터 없음 |
| R3 | 이적 재정 IN/OUT 손익 정산 없음 | `TransfersPage.tsx:196` | PERMANENT_IN/OUT별 수입·지출 집계 없어 순이적손익 산출 불가 |
| R4 | 선수 등급별 임금 벤치마킹·이상 탐지 없음 | `ContractDetailPage.tsx:225` | YOUTH/ROOKIE/SENIOR/VETERAN 등급과 연봉 연계 분석 없음 |
| R5 | Prospect 영입 총비용 추적 불가 | `ProspectsPage.tsx:161` | 스카우팅·의료검사·비자 비용이 계약 체결에 미연결 |

### David Park (구단 관리자) — 5 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| D1 | 계약 상태 변경 감사 추적·승인 체계 없음 | `contract.controller.ts:39` | 변경자·이유·승인 흐름 미기록, 분쟁 시 증빙 불가 | ✅ PR #192 |
| D2 | 선수 상태 ↔ 계약 상태 연계 없음 | `PlayerStatusDialog.tsx:34` | RELEASED 처리 후 ACTIVE 계약 잔존 가능, K리그 이중 등록 위험 |
| D3 | 외국인 쿼터·비자·노동허가 관리 체계 전무 | `PlayerFormDialog.tsx:59` | 국적 필드만 있고 비자 상태·쿼터 추적 없음 | Issue #193 |
| D4 | 이적 후 계약 종료·신규 계약 자동화 없음 | `TransfersPage.tsx:55` | LOAN_OUT 기록만 되고 기존 계약 TERMINATED 처리 미연동 |
| D5 | 보너스·바이아웃·연장옵션 조건 자동 실행 없음 | `ContractDetailPage.tsx:110` | 조건 입력 가능하나 달성 감지·자동 실행 없음 |

---

## 섹션 3: 재무 보고서 관리

### Jack (재무팀장) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| J1 | 원장 오류 거래 정정 불가 (감사 추적 단절) | `ledger.repo.ts` | Create만 있고 역분개 없음, 오류 거래 영구 잔존 | ✅ PR #194 |
| J2 | 원장 환불 생성 권한 체크 전무 | `ledger.controller.ts:17` | refund 엔드포인트에 `canWriteFinance` 없음, 누구나 환불 생성 가능 | ✅ PR #192 |
| J3 | 원장 조회 권한 제약 없음 | `ledger.controller.ts:8` | 모든 인증 사용자가 급여·계약금 포함 전체 원장 조회 가능 | ✅ PR #192 |
| J4 | 환율 입력값 검증 부재 | `ledger.service.ts:13` | exchangeRate 상한/하한 없어 임의 환율 입력 → 원화 환산액 조작 가능 | ✅ PR #194 |
| J5 | relatedModule/relatedId 존재 검증 없음 | `ledger.dto.ts:13` | 비존재 계약·이적 ID 연결 가능, 감사 추적 허위 기록 가능 | ✅ PR #194 |
| J6 | 월별 마감(Month-end Closing) 잠금 없음 | `schema.prisma` | LedgerEntry에 periodLock 필드 없어 결산 후 소급 입력 가능 |
| J7 | 보고서-원장 연결고리 부재 | `ReportsPage.tsx:181` | Report와 LedgerEntry 미연결, 보고서 원본 거래 대사 불가 |
| J8 | 예산 집행률 KPI 세분화 부재 | `ops-report.service.ts:66` | 카테고리별 집행률 없이 전체 단일 수치 — 의료비 150% 초과해도 감지 불가 |
| J9 | 원장 description 자유 텍스트 (분류 오류) | `ledger.dto.ts:12` | 같은 SALARY 거래가 "계약금"/"보너스"/"수당"으로 혼용 기록 |
| J10 | 재무보고서 자기 승인 가능 (이해충돌) | `report.controller.ts:126` | 작성자가 1차 승인자가 될 수 있는 권한 체크 부재 | ✅ PR #194 |

---

## 섹션 4: 전술·훈련 데이터

### 이영표 (Technical Director, 완전 T형) — 전술 10개

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| T1 | 포메이션 선택 ↔ 경기 결과 상관관계 추적 불가 | `TacticalAnalysisPage.tsx:160` | PRE_MATCH 포메이션과 승/패 연결 쿼리 없음 |
| T2 | 상대팀 분석 전부 자유 텍스트, 정량화 없음 | `TacticalAnalysisPage.tsx:162` | opponentKeyThreat 등 string — 위협도 점수화·비교 불가 |
| T3 | MOM 지명 경기 통계 연결 없음 | `TacticalAnalysisPage.tsx:167` | xG·패스정확도 자동 매칭 없어 지명 근거 주관적 |
| T4 | 포메이션 변경 시 라인업 자동 재배치 없음 | `MatchLineupPage.tsx:310` | 포메이션 변경 후 배치 자동 검증·조정 안 됨 |
| T5 | 계획 포메이션 vs 실제 사용 포메이션 분리 기록 없음 | `tactical.repo.ts:8` | PRE/POST 동일 필드 — 전술 변경 사유 추적 불가 |
| T6 | 라인업 확정과 전술 분석 타이밍 동기화 없음 | `MatchLineupPage.tsx:366` | 독립 동작, 포메이션 정합성 보장 없음 |
| T7 | 경기 중 포메이션 변경 이력 버전 관리 없음 | `tactical.service.ts:27` | 경기 중 전술 변경 기록 불가 — 수정 효과 분석 불가 |
| T8 | 상대팀별 분석 누적·검색 인프라 없음 | `tactical.service.ts:11` | matchId/phase 필터만, 상대팀 키워드 전문 검색 불가 |
| T9 | 경기 결과(스코어)와 전술 분석 자동 연결 없음 | `tactical.ts:12` | Match.homeScore가 TacticalAnalysis 조회에 미포함 |
| T10 | 라인업·전술 간 포지션 타입 표준화 불일치 | `MatchLineupPage.tsx:566` | 라인업=Position enum, 전술=string — 포지션 변경 분석 불가 |

### 이영표 (Technical Director, 완전 T형) — 훈련 데이터 10개

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| TR1 | RPE 수집 강제성 없음 — 장기 추이 추적 불가 | `training-load.service.ts:28` | 선수 자발 입력, optional — 부하-부상 상관관계 붕괴 |
| TR2 | 훈련 평가 누락률 모니터링 없음 | `TrainingDetailPage.tsx:199` | performanceScore optional, 누락 이유 구분 없음 |
| TR3 | 지각 정의 모호 — "3회=1결석" 통계 근거 없음 | `training.service.ts:11` | 10분=1시간 지각 동일 취급, threshold 3 근거 불명 |
| TR4 | 세션 승인 후 평가 완성도 자동 검증 없음 | `training.repo.ts:117` | "승인된 세션" ≠ "완성된 데이터" |
| TR5 | 훈련 부하 단위·유형 미정의 | `training-load.ts:1` | `load: number` 단위 불명, THRESHOLD=500 기준 불명 |
| TR6 | 세션 타입별 부상 발생률 연계 없음 | `training.ts:1` | 7가지 SessionType 있으나 타입별 부상률 집계 없음 |
| TR7 | 부상 이력 ↔ 훈련 부하 상관관계 분석 불가 | `training.repo.ts:82` | 부상 직전 훈련 강도 쿼리 파이프라인 없음 |
| TR8 | 포지션별 평균 점수 표본 크기 통제 없음 | `CoachDashboardPage.tsx:46` | GK N=1, CB N=10 동일 취급, 신뢰구간 없음 |
| TR9 | 선수 장기 성장 궤적 추적 불가 | `StatsTab.tsx:164` | trainingResults 나열만, 이동평균·추세선 없음 |
| TR10 | 데이터 입력 역할 파편화 + 누락 책임 추적 불가 | `TrainingDetailPage.tsx:76` | RPE=선수/점수=코치/부하=피지컬코치, 누락 책임자 식별 불가 |

---

## 섹션 5: 선수 컨디셔닝·훈련 부하

### Kane (Technical Director, 영국, 15년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| KN1 | RPE 데이터 DB 레벨 검증 누락 | `training-load.repo.ts:27` | 서비스 레벨 1-10 검증만 있고 DB 제약 없음 — 직접 접근 시 무효 RPE 저장 가능, 부하 분석 신뢰성 파괴 |
| KN2 | 트레이닝로드 입력자·타임스탬프 미기록 | `training-load.service.ts:22` | upsert 시 누가 언제 입력했는지 저장 안 됨 — 데이터 오류 원인 추적 불가 |
| KN3 | 포지션별 부하 임계값 없음 (단일 500 고정) | `training-load.service.ts:6` | 전 포지션 WEEKLY_LOAD_THRESHOLD=500 동일 적용 — GK·CB·ST 체력 요구도 차이 무시 |
| KN4 | PerformanceScore 범위 검증 없음 | `training.dto.ts:25` | 점수 상한/하한 미정의 — 5000 입력 가능, 포지션 평균값 왜곡 |
| KN5 | 주간 부하 집계 타임존 미처리 | `training-load.service.ts:87` | getWeekStart() UTC 기반 — 한국 오후 입력이 이전 주로 분류될 수 있음 |
| KN6 | 재활 복귀 부분 훈련 부하 카운트 미반영 | `training.repo.ts:104` | 부상 선수 ABSENT_AUTHORIZED 자동 처리, 복귀 재활 훈련 부분 참여 기록 없음 |
| KN7 | 부하-RPE 연관 분석 불가 | `training-load/` | 부하·RPE 분리 저장, "부하↑ RPE↓" 이상신호 자동 감지 쿼리 없음 |
| KN8 | 세션별 목표 부하(targetLoad) 필드 없음 | `training.dto.ts:3` | 계획 부하 vs 실제 부하 비교 불가 — 훈련 완성도 평가 불가 |
| KN9 | 부하 초과 알림 fire-and-forget | `training-load.service.ts:50` | Promise.all().catch(console.error) — 알림 실패해도 모름, 코치가 경고 미수신 가능 |
| KN10 | 부하 이력 덮어쓰기 (변경 추적 불가) | `training-load.repo.ts:21` | upsert로 이전 값 영구 소실 — 부하 변동 패턴·조작 검증 불가 |

### 박희수 (의무팀, 한국, 15년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| BH1 | RPE 기본값 5 자동 할당 — 의료진 투명성 없음 | `training-load.repo.ts:27` | 미입력 시 RPE=5 자동 채움 — 실제 체감강도와 무관한 데이터로 피로도 판단 오류 초래 |
| BH2 | 재활 중 부분 훈련 참여 제어 없음 | `training.repo.ts:82` | REHABILITATING 선수 전체 결석 처리만 — 상체 훈련만 허용 등 세분화 제어 불가 |
| BH3 | 부하 초과 알림에 의료진 미포함 | `training-load.service.ts:47` | HEAD_COACH·PHYSICAL_COACH만 알림 수신 — MEDICAL_DIRECTOR 제외, 부상 위험 선수 모니터링 불가 |
| BH4 | 부상 시점 훈련 부하 연계 필드 없음 | `injury.dto.ts:1`, `training-load.dto.ts:1` | InjuryCause만 있고 직전 부하 데이터 링크 없음 — 훈련강도↔부상률 인과관계 분석 불가 |
| BH5 | Acute:Chronic 부하 비율 계산 없음 | `training-load.service.ts:6` | 주간 부하만 추적, 4주 이동평균 대비 당주 급증 감지 불가 — 단기 부상 위험 사각지대 |
| BH6 | 복귀 단계 전이 조건 자동 검증 없음 | `injury.service.ts:75` | REHABILITATING→READY_TO_RETURN 조건(훈련 참여 기간 등) 시스템 검증 없음 — 조기 복귀 위험 |
| BH7 | 의무팀 부상 업데이트 → 훈련 계획 미반영 | `training.service.ts:66`, `injury.repo.ts:58` | 훈련 결과 저장 시 현재 부상 상태 재확인 없음 — 의무 업데이트가 코칭에 자동 전달 안 됨 |
| BH8 | 평가 점수 80+ 내부 액션 규정 없음 | `injury.service.ts:159` | 80점 이상 외부 보고서만 자동 생성 — 의무팀 내부 재활 강화·훈련 제한 조치 수동 기록만 |
| BH9 | MatchAvailable과 훈련 부하 연동 없음 | `injury.repo.ts:146`, `training-load.service.ts:18` | 의료진 matchAvailable 설정 시 부하 이력 자동 재검토 없음 — 과부하 상태 선수 출전 승인 위험 |
| BH10 | 부상 발생 후 훈련 데이터 동결 메커니즘 없음 | `training.repo.ts:82` | 부상 발생 시점 이전 훈련 기록이 소급 수정될 수 있음 — 사고 조사 시 원본 데이터 보존 불가 |

---

## 우선순위 요약

### 즉시 처리 필요 (보안·규정 위반)
- **IS2/RA4** JWT 시크릿 기본값·예제값 노출 ✅ PR #192
- **IS3** 전화번호 암호화 키 하드코딩 ✅ PR #192
- **IS4** /uploads 정적 파일 전체 공개 ✅ PR #192
- **IS7/RA1/RA2** 부상 정보 무인증 전체 조회 ✅ PR #192
- **IS8** safeguard 신고 인증 없음 ✅ PR #192
- **IS10** 학비 엔드포인트 무인증 ✅ PR #192
- **RA3** DB 자격증명 평문 ✅ PR #192
- **RA5/J3** 원장 전체 공개 ✅ PR #192
- **J2** 원장 환불 권한 무방비 ✅ PR #192
- **PA7/JO5** 스폰서·환불 권한 없음 ✅ PR #192
- **IS1/RA9** SUPER_ADMIN 팀 컨텍스트 검증 ✅ PR #192
- **D1** 계약 변경 감사 추적 없음 ✅ PR #192
- **D3** 외국인 쿼터·비자 관리 없음 (K리그 규정 위반) → Issue #193

### 단기 처리 (데이터 정합성)
- **IS1/RA9** SUPER_ADMIN x-team-id 헤더 위변조
- **IS9** 감사 로그 위변조 방지 없음
- **RA7** 외부 의료 전송 동의 로그 없음
- **BS1/BS7/JO1** SalesRecord 삭제·트랜잭션 미처리
- **D2** 선수 상태 ↔ 계약 상태 불일치
- **J6** 결산 마감 잠금 없음
- **J10** 자기 승인 이해충돌 ✅ PR #194
- **BH3** 부하 초과 알림 의료진 미포함
- **KN9** 부하 초과 알림 fire-and-forget
- **PA5** 스폰서 원장 연계 무음 실패

### 중기 처리 (KPI·운영 완결성)
- **BS3/BS9/JO9** Ticket·Fan·Membership 모델 신설
- **KD6** 시설 예약 모델 신설
- **Y1~Y4** KPI 드릴다운 컨텍스트 부족
- **R1~R3** 재무 집계 뷰 없음
- **J7~J9** 보고서 감사 연결
- **KN3** 포지션별 부하 임계값
- **BH5** Acute:Chronic 부하 비율 계산
- **SJ7/CL9** 채용 KPI (목표 인원·Time-to-Hire)
- **TR4/TR9** 예방 유지보수 정기 스케줄링

---

## 섹션 6: 스폰서십·파트너십

### 빠뜨롱 (자산관리사, 한국, 15년차, 완전 T형) — 계약·재무 10개

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| PA1 | 계약 갱신 시 지불 일정 재계산 없음 | `sponsorship.service.ts:59` | contractStart/End 변경 시 기존 SponsorshipPayment 미수정 — 납부 일정·계약기간 불일치, 재무 정합성 파괴 |
| PA2 | 지불 금액 반올림 오차 누적 | `sponsorship.service.ts:46` | Math.floor() 후 toFixed(2) — 10억 분할 시 소수점 손실 누적, 감사 증거 불충분 |
| PA3 | SponsorshipPayment onDelete 정책 없음 | `schema.prisma:2510` | 스폰서십 삭제 시 결제 기록 orphan → 원장 불일치 증거 소실 |
| PA4 | 계약 조건부 조항 처리 불가 | `schema.prisma:880` | Sponsorship 모델에 KPI 연동 할인·환불 조항 필드 없음 — 계약서와 ERP 데이터 완전 분리 |
| PA5 | 원장 연계 void+catch → 무음 실패 | `sponsorship.service.ts:81` | `void ledgerService.createAutoEntry().catch()` — 원장 등재 실패 시 무시, 감사 시 수입 미기록 |
| PA6 | 다중 통화 환율 고정 (exchangeRate: 1) | `sponsorship.service.ts:86` | USD/EUR 스폰서십도 환율 1 고정 — 환손익 미처리, 해외 스폰서 매출 인식 오류 |
| PA7 | 지불 현황 조회 인증 없음 | `sponsorship.controller.ts:49` | getPayments() requireUser() 미호출 — 무관계자 스폰서 납부 내역 전체 조회 가능 |
| PA8 | 스폰서십 ROI·노출도 측정 구조 없음 | `schema.prisma:2482` | Sponsorship 모델에 노출 횟수·미디어 가치·팬 도달률 필드 없음 — 계약 가치 평가 불가 |
| PA9 | 스폰서십 만료 알림 자동화 없음 | `sponsorship.service.ts` | findExpiringContracts() 없음 — 계약 만료 사전 감지 불가, 갱신 실패 시 매출 공백 |
| PA10 | 지불 금액 검증 없음 (중복·음수·초과) | `sponsorship.repo.ts:67` | amount 유효성 검사 없음 — 중복 결제·음수 금액·계약 초과 등기 가능, 원장 수익 오염 |

### 빠뜨롱 (자산관리사, 한국, 15년차, 완전 T형) — 운영·데이터 10개

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| PB1 | 계약 변경 이력 감사 로그 없음 | `sponsorship.service.ts:59` | update() 시 금액·기간 변경 감사 로그 없음 — "언제 계약금이 변경됐나" 증명 불가 |
| PB2 | 스폰서 브랜드 노출 의무 이행 추적 없음 | `sponsorship/` 전체 | 광고판 노출 일정·경기당 노출 횟수·소셜 언급 기록 테이블 없음 — 파트너사 클레임 대응 불가 |
| PB3 | 파트너 계층 분류 기준 부재 | `partner.dto.ts:1` | PartnerType = MANUFACTURER·HOSPITAL만 존재 — 공식 파트너/공급사/병원 구별 없어 스폰서 가치 차등화 불가 |
| PB4 | 파트너 접촉 이력 CRM 없음 | `partner.repo.ts` 전체 | 연락 일시·담당자·소통 내용 기록 불가 — 담당자 이직 시 관계 단절, 분쟁 소통 증거 없음 |
| PB5 | 파트너 성과 KPI ops-report 미포함 | `ops-report.service.ts:26` | 파트너별 서비스 이용률·만족도·ROI 기여도 없음 — 스폰서·파트너 성과 평가 불가 |
| PB6 | 스폰서십 데이터 삭제 방어 없음 | `sponsorship.service.ts` 전체 | soft-delete·archive 없음, cascade 정책 미정의 — DB 실수 삭제 시 복구 불가 |
| PB7 | 스폰서 납부 현황 권한 제어 미흡 | `sponsorship.controller.ts:49` | getPayments() 인증 없음 — COACHING_STAFF 등 무관계자 납부 내역 조회 가능 |
| PB8 | 갱신 파이프라인 알림 체계 없음 | `partner.repo.ts:110` | findExpiringContracts()는 파트너 계약만, 스폰서십 만료 90/30일 전 알림 없음 |
| PB9 | 스폰서십 수입 예산 연계 없음 | `ops-report.service.ts:66` | 스폰서 납부 실적이 예산 집행률 KPI에 미포함 — 스폰서 수입 vs 계획 비교 불가 |
| PB10 | 분할 지급 계산 오류 감사 의심 유발 | `sponsorship.service.ts:39` | 마지막 회차에만 잔액 모이는 로직 — "왜 마지막 수금액이 다른가" 감사 조사 비용 낭비 |

---

## 섹션 7: 시설 관리·장비 관리

### 김동욱 (시설관리팀장, 한국, 18년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| KD1 | 장비 반납 타임스탬프 미기록 | `equipment.repo.ts:136` | getUnreturnedByPlayer() 반납된 장비만 검색, 반납 타임스탬프 없음 — 실제 반납 여부 검증 불가, 사고 시 책임 소재 불명 |
| KD2 | 장비 점검 주기·다음 점검일 필드 없음 | `schema.prisma:1359` | EquipmentUnit에 expiresAt만 있고 마지막 점검일·점검 주기·다음 점검 예정일 없음 — 장비 수명 관리 파탄 |
| KD3 | 시설 점검 기록 변경 추적 불가 | `inspection.repo.ts:44` | FacilityInspection에 updatedAt 없음 — 점검 결과 변경·위변조 감시 불가 |
| KD4 | 유지보수 비용 변경 감사 로그 없음 | `maintenance.service.ts:65` | actualCost 입력 시 감사 로그 없음 — 비용 조작·횡령 위험 |
| KD5 | 장비 폐기 시 담당자 미기록 | `equipment.service.ts:94` | RETIRED 상태 변경 시 userId 미기록 — 누가 폐기했는지 추적 불가 |
| KD6 | 시설 예약 모델 전무 | `schema.prisma:2435` | FacilityReservation 모델 없음 — 경기장·훈련장 사용 일정 관리 기능 전무 |
| KD7 | 외부 업체 유지보수 계약 연계 없음 | `schema.prisma:949` | Partner·PartnerContract와 MaintenanceRequest 연결 필드 없음 — 어떤 업체가 어떤 시설 관리하는지 추적 불가 |
| KD8 | 안전점검 인증서 만료 알림 없음 | `inspection.controller.ts:37` | certificateUrl·statutoryDeadline 저장만, 만료·갱신 알림 로직 전무 |
| KD9 | 장비 대여 반납 감사 미기록 | `equipment.service.ts:176` | EquipmentLoan returnedAt 변경 시 반납자·감사 로그 없음 — 차용자 책임 회피 가능 |
| KD10 | 유지보수 요청 승인 우회 가능 | `maintenance.service.ts:44` | OPEN→REJECTED 직접 전환 가능 — 승인 프로세스 회피, 내부 견제 없음 |

### Trevor (Stadium Operations Manager, 영국, 14년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| TR1 | 상태 전이 화이트리스트 없음 | `maintenance.controller.ts:50` | updateStatus() 상태 전이 검증 불충분 — 법적 승인 절차 무시하는 잘못된 전환 가능 |
| TR2 | 유지보수 비용 임계값 하드코딩 | `maintenance.service.ts:100` | 재무 제출 최소 비용 1,000,000 KRW 고정 — 구단 정책 변경 불가, 감사 증명 불가 |
| TR3 | 안전 인증 만료 추적 없음 | `inspection.repo.ts:27` | statutoryDeadline 저장만, 만료 알림·재검사 강제·준수 검증 없음 — UEFA 기준 미충족 |
| TR4 | 정기 예방 유지보수 일정 없음 | `schema.prisma:2435` | 일회성 점검만 지원, 월간·분기·연간 예방 유지보수 스케줄링 불가 |
| TR5 | 장비 반납 지연 자동 회수 없음 | `equipment.service.ts:187` | returnedAt 기록만, 반납 지연 시 자동 알림·벌금 없음 — 장비 손실 책임 추적 불가 |
| TR6 | 승인 이력 변경 사유 미기록 | `maintenance.repo.ts:66` | 승인자 기록만 있고 거절 이유·이전 상태 이력 없음 — 규정 위반 추적 불가 |
| TR7 | 시설 접근 제어·보안 로깅 전무 | `facility.routes.ts:1` | 구역별 권한 관리·입출입 로그·비정상 접근 경보 없음 |
| TR8 | 장비 폐기 물리 검증 없음 | `equipment.service.ts:94` | 폐기 시 bookValue 환입만, 물리 폐기 증명서·서명 프로세스 없음 |
| TR9 | 예방 유지보수 자동 스케줄링 없음 | `maintenance.service.ts:1` | 검사 유형별 재검사 자동 스케줄링 없음 — 수동 누락 시 규정 위반 |
| TR10 | 장비 구매·유지보수 벤더 연결 없음 | `equipment.repo.ts:1` | 구매·유지보수 비용이 Partner/계약과 미연결 — 벤더별 성과 평가·계약 위반 추적 불가 |

---

## 섹션 8: 채용·인재 파이프라인

### 서지혜 (채용팀장, 한국, 11년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| SJ1 | 지원자 상태 변경 감사 로그 없음 | `recruitment.repo.ts:102` | 합격·거절 상태 전환 시 writeAuditLog() 없음 — 채용 분쟁 시 증빙 부재 |
| SJ2 | 거절 사유 미기록 | `schema.prisma:2305` | JobApplication에 rejectionReason 필드 없음 — 차별·부당 거절 의혹 증명 불가 |
| SJ3 | 면접 점수 필드 전부 선택적 | `schema.prisma:2330` | scoreSkill·scoreComm·scoreCulture nullable — 채용 결정 근거 추적 불가 |
| SJ4 | 지원자 개인정보 열람 권한 미차등 | `recruitment.service.ts:17` | HEAD_COACH와 HR_MANAGER 동등 처리 — 불필요한 직급의 PII 접근 가능 |
| SJ5 | 온보딩 완료 후 StaffRecord 자동 생성 없음 | `recruitment.service.ts:156` | completeMfa()에서 StaffRecord 자동 생성 없음 — 채용 완료 후 수작업 필요 |
| SJ6 | 지원자 상태 전환 통보 없음 | `recruitment.service.ts` 전체 | 합격·불합격·면접 단계 진행 시 지원자 알림 코드 없음 |
| SJ7 | 채용 목표 인원 진척률 미집계 | `recruitment.service.ts:33` | headcount 필드 있으나 합격자 수 집계 로직 없음 — 목표 대비 실적 대시보드 없음 |
| SJ8 | 레퍼런스 체크 결과 FLAGGED 차단 없음 | `recruitment.repo.ts:170` | FLAGGED 결과에도 지원자 합격 수락 방지 로직 없음 |
| SJ9 | 채용 의사결정 권한 충돌 | `recruitment.controller.ts:20` | canWriteHR()만 체크 — HEAD_COACH 읽기 전용 권장이나 실제 권한 흐름 미반영 |
| SJ10 | 지원 채널(source) 선택적 저장 | `schema.prisma:2318` | ApplicationSource nullable — 채널별 채용 효율·비용 분석 불가 |

### Claire (Talent Acquisition Director, 영국, 9년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| CL1 | 면접 기록 HEAD_COACH까지 열람 가능 | `recruitment.controller.ts:20` | canRead()에 HEAD_COACH 포함 — 불합격자 피드백 보안 위반, 차별금지법 대상 |
| CL2 | 불합격 사유 기록 누락 | `schema.prisma:2312` | JobApplication에 rejectionReason 없음 — GDPR 동의권·한국 고용 분쟁 입증 불가 |
| CL3 | 면접 점수 수정 이력 없음 | `recruitment.repo.ts:153` | 점수·코멘트 수정 이력 없음 — 면접관 점수 조작 추적 불가 |
| CL4 | 면접 일정 통보 미구현 | `recruitment.routes.ts:32` | Interview 예약 시 지원자 일시·장소·면접관 통보 없음 — GDPR Art.13 위반 |
| CL5 | 레퍼런스 체크 동의 추적 없음 | `recruitment.service.ts:124` | 전 직장 연락처 조회 전 지원자 동의 확인 없음 — 개인정보보호법 위반 |
| CL6 | 불합격자 데이터 보관 기간 정책 없음 | `recruitment.repo.ts` 전체 | 채용 종료 후 자동 삭제·익명화 없음 — GDPR 필요성 원칙 위배 |
| CL7 | 면접관별 개별 점수 기록 없음 | `schema.prisma:2335` | interviewerIds 배열만 있고 개별 점수 없음 — 공정 평가 입증 불가 |
| CL8 | 합격 후 StaffRecord 자동 생성 없음 | `recruitment.repo.ts:118` | Onboarding 완료 후 StaffRecord 트랜잭션 자동 생성 없음 — 급여 시스템 오류 초래 |
| CL9 | Time-to-Hire 추적 불가 | `schema.prisma:2284` | 단계별 소요 기간 자동 계산 필드 없음 — 채용 효율·차별 패턴 분석 불가 |
| CL10 | Cost-per-Hire 미추적 | `schema.prisma:2284` | JobPosting.budget 없음 — 채용 원가·ROI 분석 불가 |

---

## 섹션 9: 팬 운영·티켓

### 박성준 (팬서비스팀장, 한국, 8년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| BS1 | 티켓 삭제 시 Ledger 롤백 없음 | `sales.service.ts:78`, `sales.repo.ts:37` | SalesRecord 삭제 시 LedgerEntry 동시 삭제 없음 — 환불액 대차 불일치 |
| BS2 | Refund 로직 SalesRecord 미연계 | `ledger.controller.ts:17` | Ledger만 음수 생성, SalesRecord는 refund 미처리 — 판매기록·원장 비정합 |
| BS3 | Ticket·Fan·Membership 모델 전무 | `schema.prisma` 전체 | 티켓 타입·팬 구매 이력·멤버십 모델 없음 — 팬 이탈 추적·재방문율 분석 불가 |
| BS4 | Match 모델에 관중수·점유율 필드 없음 | `schema.prisma:1087` | actualAttendance·capacity·occupancyRate 없음 — 경기별 매출 검증 불가 |
| BS5 | SalesRecord 필터링 검색 없음 | `sales.repo.ts:7` | 팬ID·좌석구역·취소 상태 필터 없음 — 팬 이탈 원인 추적 봉쇄 |
| BS6 | 무임 발권 통제·감사 없음 | `sales.dto.ts:1` | ticketType·issuedBy·approvalId 필드 없음 — 무임권 관리·횡령 리스크 |
| BS7 | SalesRecord 삭제 트랜잭션 없음 | `sales.service.ts:41` | delete()는 트랜잭션 미사용 — 부분 삭제 시 감사 추적 파탄 |
| BS8 | Ledger 환불 원본 양방향 링크 없음 | `ledger.service.ts:18` | 환불 생성 시 description에만 원본 ID 저장 — 원본·환불 연결 추적 불가 |
| BS9 | 팬 구매 이력·멤버십 완전 부재 | `schema.prisma` 전체 | 팬 개별 구매 이력·멤버십 등급·갱신 정보 없음 — 우량팬 관리·재방문율 분석 불가 |
| BS10 | 좌석 배치·점유율 추적 전무 | `schema.prisma` 전체 | Seat·SeatMap·Occupancy 모델 없음 — 경기별 점유율 KPI 신뢰성 0 |

### Jordan (Head of Ticketing & Fan Engagement, 영국, 16년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| JO1 | SalesRecord 물리 삭제 허용 | `sales.repo.ts:37` | soft-delete 없음 — 재정 보고·원장 불일치, 부정 삭제 감지 불가 |
| JO2 | 티켓 일련번호 없음 | `schema.prisma:2633` | SalesRecord 수량만 추적 — 중복 판매·불법 재판매 감지 불가 |
| JO3 | 경기장 수용인원 초과 판매 방지 없음 | `schema.prisma:1087` | Match·Team 모델에 capacity 없음 — 초과 판매 방지 메커니즘 부재 |
| JO4 | 환불과 원본 티켓 연결 없음 | `ledger.service.ts:18` | 환불 시 원본 SalesRecord 연결 없음 — 중복 환불 가능 |
| JO5 | 환불 엔드포인트 권한 없음 | `ledger.routes.ts:16` | POST /:id/refund auth만 확인, canWriteFinance 없음 |
| JO6 | 무료·VIP 티켓 분류 없음 | `sales.dto.ts:1` | COMPLIMENTARY·VIP_GUEST 카테고리 없음 — 경비 추적 불가 |
| JO7 | 티켓 수익 원장 자동 조정 없음 | `financial-report.service.ts:79` | 재정 보고 CSV 수동 입력 — SalesRecord 합계·LedgerEntry 자동 대사 없음 |
| JO8 | SalesRecord 수정 감사 추적 없음 | `sales.service.ts:20` | updatedAt·updatedById 없음 — 수정·삭제 이력 추적 불가 |
| JO9 | 시즌권 갱신 파이프라인 없음 | `schema.prisma` 전체 | 시즌권·멤버십 모델 없음 — 구독 갱신·만료 자동화 불가 |
| JO10 | 경기일 KPI에 티켓 데이터 없음 | `ops-report.service.ts:26` | computeOpsKpi에 티켓 매출·환불율·점유율 없음 |

---

## 섹션 10: IT·데이터 보안

### 이상훈 (IT보안팀장, 한국, 13년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| IS1 | SUPER_ADMIN x-team-id 헤더 위변조 | `authMiddleware.ts:30` | SUPER_ADMIN이 헤더만으로 teamId 변경 가능 — 임의 팀 데이터 접근, 최소 권한 원칙 위반 |
| IS2 | JWT 시크릿 예제값 그대로 .env 저장 | `.env:14` | "JWT_ACCESS_SECRET" 등 기본값 — 토큰 위조 가능, 개인정보보호법 시행령 제21조 위반 |
| IS3 | 전화번호 암호화 키 하드코딩 노출 | `.env:18` | PHONE_ENCRYPTION_KEY 16진수 평문 — 전화번호 복호화 가능 | ✅ PR #192 |
| IS4 | /uploads 정적 파일 전체 공개 | `server.ts:39` | express.static으로 업로드 디렉토리 공개 — 의료·계약 파일 무인증 접근 가능 |
| IS5 | 선수 시장가치 조회 접근 로그 없음 | `player.controller.ts:96` | 조회 권한 제한은 있으나 감사 로그 없음 — 누가 언제 조회했는지 추적 불가, 개인정보보호법 위반 |
| IS6 | 보호자 초대 코드 4바이트 브루트포스 가능 | `guardian.service.ts:36` | randomBytes(4) = 2^32 — 브루트포스 가능, 사용 후 즉시 삭제 없음 |
| IS7 | 부상 정보 인증 없이 전체 조회 가능 | `injury.controller.ts:23` | getActive() 권한 검사 없음 — 의료 정보 최소 권한 원칙 위반 |
| IS8 | safeguard 신고 엔드포인트 인증 없음 | `safeguard.controller.ts:8` | submit()에 requireUser 없음 — 거짓 신고·DoS 가능 |
| IS9 | 감사 로그 삭제·위변조 방지 없음 | `auditLog.ts:3` | 감사 로그 생성 후 수정·삭제 제약 없음 — 행위자 자신의 로그 삭제 가능 |
| IS10 | 학비 엔드포인트 무인증 | `academy-fee.controller.ts:15` | getAll()·issueMonthlyFees()·approvePayment() 권한 검증 없음 — 학생 개인정보·재정 전체 노출 |

### Rachel (Head of Information Security, 영국, 11년차) — 10 Criticals

| # | 제목 | 파일 | 핵심 문제 |
|---|------|------|-----------|
| RA1 | 활성 부상 전체 조회 역할 제한 없음 | `injury.controller.ts:23` | getActive() 모든 인증 사용자 접근 — GDPR Art.9 특수 범주 데이터 무단 노출 |
| RA2 | 의료 보고서 조회 인증 없음 | `injury.controller.ts:57` | getReport() 접근 제어 없음 — 진단·치료·재활 전 데이터 전체 공개 |
| RA3 | DB 자격증명 평문 저장 | `.env:12` | DATABASE_URL에 postgres:1234 — 자격증명 유출 시 전체 DB 접근 가능 | ✅ PR #192 |
| RA4 | JWT 시크릿 기본값 폴백 | `constants.ts:4` | env 미설정 시 "jwt-access-secret" 폴백 — 토큰 위조 허용, 7일 갱신 토큰 탈취 창 과대 |
| RA5 | 원장 전체 조회 역할 제한 없음 | `ledger.routes.ts:13` | GET /·GET /:id auth만 — COACHING_STAFF·PLAYER가 급여·계약금 원장 조회 가능 |
| RA6 | 선수 API 응답에 PII 과다 포함 | `player.repo.ts:55` | 표준 쿼리에 계약 급여·보호자·긴급연락처 포함 — 역할 무관 노출 |
| RA7 | 외부 의료 보고서 전송 동의 로그 없음 | `injury.repo.ts:251` | EDUCATION_OFFICE 등 제3자 전송 시 동의 감사 없음 — GDPR Art.5·32 위반 |
| RA8 | 의료 기록 보관 기간 정책 없음 | `schema.prisma:997` | Injury·InjuryReport 무기한 보관 — GDPR Art.5(e) 저장 제한 원칙 위반 |
| RA9 | SUPER_ADMIN 팀 컨텍스트 헤더 미검증 | `authMiddleware.ts:29` | x-team-id 헤더 무검증 — 타 팀 선수 데이터 수평 이동 가능 |
| RA10 | 의료 데이터 접근 감사 로그 불충분 | `schema.prisma:1408` | AuditLog에 누가 어떤 의료 데이터를 읽었는지 미기록 — GDPR Art.5·32 책임 원칙 미충족 |

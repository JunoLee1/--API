# 감독 뷰 설계 스펙

> 작성일: 2026-08-07  
> 페르소나 출처: 박지성 (FC Seoul 감독, IT 약자)  
> 범위: 메뉴 정리 + HEAD_COACH 대시보드 3-box + i18n 상태값 번역

---

## 배경

박지성 페르소나 분석에서 도출된 핵심 고통점:
- 재무·계약·시설 메뉴까지 전부 노출돼 감독에게 불필요한 항목이 2/3 이상
- 오늘 훈련 결석자·복귀 임박 부상자·다음 경기 D-Day가 한눈에 안 보임
- 메인 대시보드 + 코치 대시보드 2개 존재로 진입점 혼란
- 훈련·경기 상태값이 영어로 노출 (DRAFT, Individual Skill 등)

**제외 항목 (별도 티켓):** 테이블 컬럼 단순화, 스쿼드 플래너 저장, 전술 보고서 읽기 전용 뷰

---

## 1. 메뉴 정리

### 변경 파일
`football/src/layouts/AppShell.tsx` — NAV_ITEMS 각 항목의 `roles` / `coachingRoles` 필터 수정

### 표시 메뉴 (COACHING_STAFF 전체)
| 메뉴 | 조건 |
|------|------|
| 대시보드 | 항상 표시 |
| 선수관리 | 항상 표시 |
| 훈련 | 항상 표시 |
| 경기 | 항상 표시 |
| 보고서 | 항상 표시 |
| 유소년 | HEAD_COACH만 |

### 숨길 메뉴 (COACHING_STAFF에서 제거)
- HR (채용·급여·계약)
- 재무
- 시설·장비

### 구현 방법
기존 NavItem의 `roles` 배열에서 `COACHING_STAFF` 제거하거나, `coachingRoles` 필터로 특정 역할만 허용. AppShell의 `visibleNavItems` 필터 함수는 이미 이 패턴을 지원함.

---

## 2. HEAD_COACH 대시보드 3-box

### 배치
`DashboardPage.tsx`에서 `user.coachingRole === 'HEAD_COACH'` 조건 시, 기존 stat cards **위에** `CoachQuickView` 컴포넌트 삽입.

### 컴포넌트 구조
```
CoachQuickView (신규)
├── TodayTrainingBox
├── InjuryStatusBox  
└── NextMatchBox
```

### Box 1 — 오늘 훈련
- **데이터**: `trainingApi.list(currentSeasonId)` → 클라이언트에서 `date === today` 필터
- **표시**:
  - 오늘 세션 있음 → `결석 N명` (크게) + 결석자 이름 목록
  - 결석 0명 → `전원 출석` 
  - 오늘 세션 없음 → `오늘 훈련 없음`
- **결석 기준**: `attendance === 'ABSENT_UNAUTHORIZED' || 'ABSENT_AUTHORIZED'`

### Box 2 — 부상자
- **데이터**: `injuryApi.active()` (이미 `expectedReturnDate` 포함)
- **표시**:
  - 전체 부상자 수
  - 복귀 임박(7일 이내): `expectedReturnDate`가 오늘~7일 이내인 선수 이름 목록
  - 부상자 없음 → `부상자 없음`

### Box 3 — 다음 경기
- **데이터**: `matchApi.list({ seasonId })` → 클라이언트에서 `date > now` + `homeScore === null` 필터 후 가장 가까운 경기
- **표시**:
  - D-Day 숫자 (크게)
  - 상대팀명 + 날짜·시간
  - 경기 없음 → `예정 경기 없음`

### API 전략
신규 엔드포인트 없음. 기존 `trainingApi.list()`, `injuryApi.active()`, `matchApi.list()` 재사용. 데이터량이 적어 클라이언트 필터링으로 충분.

---

## 3. 대시보드 단일화

### 현재
- `/dashboard` — 메인 대시보드 (HEAD_COACH 기준 KPI cards)
- `/training/dashboard` (CoachDashboardPage) — 훈련 성과 분석

### 변경
- `/training/dashboard` 경로를 훈련 메뉴 하위로 이동 (예: `/training/analysis`)
- AppShell nav에서 코치 대시보드 링크를 "훈련" 섹션 하위로 재배치
- 감독 진입점은 `/dashboard` 하나로 통일

---

## 4. i18n 상태값 번역

### 대상 파일
`football/src/types/training.ts`

### 번역 대상
**SESSION_TYPE_LABEL** (현재 영어):
```
INDIVIDUAL_SKILL      → 개인 기술
TACTICAL_DEFENSIVE    → 수비 전술
TACTICAL_ATTACKING    → 공격 전술
TACTICAL_FULL_TEAM    → 전체 전술
PHYSICAL              → 체력
PSYCHOLOGICAL_SOCIAL  → 심리·사회
SET_PIECE             → 세트피스
```

**ATTENDANCE_LABEL** (현재 영어):
```
PRESENT              → 출석
ABSENT_UNAUTHORIZED  → 무단 결석
LATE_UNAUTHORIZED    → 무단 지각
ABSENT_AUTHORIZED    → 승인 결석
```

**PHASE_LABEL** (현재 영어):
```
WARMUP   → 워밍업
DRILL    → 드릴
TACTICAL → 전술
GAME     → 게임
```

### 구현 방법
`useTranslation` 훅 사용 없이 상수 맵을 한국어로 직접 교체. 이 프로젝트의 기본 표시 언어가 한국어이고, 해당 라벨은 UI에서 그대로 렌더링됨.

---

## 5. 파일 변경 목록 요약

| 파일 | 변경 내용 |
|------|-----------|
| `football/src/layouts/AppShell.tsx` | COACHING_STAFF 메뉴 필터링 |
| `football/src/pages/dashboard/DashboardPage.tsx` | HEAD_COACH 조건 시 CoachQuickView 삽입 |
| `football/src/components/dashboard/CoachQuickView.tsx` | 신규 — 3-box 컴포넌트 |
| `football/src/types/training.ts` | SESSION_TYPE_LABEL, ATTENDANCE_LABEL 한국어 교체 |
| `football/src/layouts/AppShell.tsx` | /training/dashboard → /training/analysis 경로 변경 |
| `football/src/pages/training/CoachDashboardPage.tsx` | 경로 재배치 |

---

## 6. 제외 항목 (후속 티켓)

| 항목 | 이유 |
|------|------|
| 테이블 컬럼 역할별 단순화 | 컴포넌트 단위 role 분기 필요, 범위 과대 |
| 스쿼드 플래너 저장 | 신규 API + DB 모델 필요 |
| 전술 분석 보고서 읽기 전용 뷰 | 별도 기능 설계 필요 |

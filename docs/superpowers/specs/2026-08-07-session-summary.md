# 2026-08-07 세션 요약 — 감독 뷰 + 3개 기능 구현 + 페르소나 리뷰

## 세션 개요

**작업 기간:** 2026-08-07  
**브랜치/PR:** #186, #187, #188, #189  
**리뷰어:** Ash (UX/UI 디자이너), 박지성 (FC Seoul 감독)

---

## 구현된 기능 (4개 PR)

### PR #186 — feat/coach-view: 감독 뷰
**목적:** 박지성 감독의 핵심 고통점 해소 — 메뉴 정리 + 대시보드 3-box

**변경 내용:**
- `AppShell.tsx`: `/equipment` COACHING_STAFF 제외, `/training/dashboard` → `/training/analysis` 경로 변경
- `CoachQuickView.tsx` (신규): HEAD_COACH 전용 3-box 카드
  - Box 1: 오늘 훈련 결석자 (이름 목록)
  - Box 2: 현재 부상자 수 + 이름
  - Box 3: 다음 경기 D-Day + 상대팀
- `DashboardPage.tsx`: HEAD_COACH 조건부 CoachQuickView 삽입
- `App.tsx`: `/training/dashboard` → `/training/analysis` 영구 리다이렉트

**Ash 리뷰 후 수정 (ab1963d):**
- InjuryStatusBox: UUID → 선수명 매핑 (`playerApi.list()` 활용)
- CoachQuickView 전체 i18n 적용 (`useTranslation('common')`)
- `ko/en common.json`: `dashboard.coachView.*` 키 9개 추가

---

### PR #187 — fix/column-simplification: 계약 섹션 숨김
**목적:** COACHING_STAFF에게 계약/급여 정보 미노출

**변경 내용:**
- `PlayerDetailPage.tsx`: `canSeeContract` 플래그 추가 (ADMIN | GM | FO-TD)
- 계약 섹션 `{canSeeContract && ...}` 조건부 렌더링

**Ash 리뷰 후 수정 (496184f):**
- 계약 숨김 시 신체 정보 카드 그리드 비대칭 → `canSeeContract ? 'md:grid-cols-2' : ''` 조건부 적용

---

### PR #188 — feat/tactical-player-readonly: PLAYER 전술 분석 읽기 전용
**목적:** PLAYER 역할이 자신이 출전한 POST_MATCH 전술 분석을 읽을 수 있게

**변경 내용 (프론트엔드):**
- `TacticalAnalysisPage.tsx`: `isPlayer` 분기 추가
  - 등록 버튼 숨김, 편집 차단, 서브타이틀 별도 표시
  - POST_MATCH 분석만 API 조회

**변경 내용 (백엔드):**
- `tactical.repo.ts`: `findAllForPlayer()`, `findByIdForPlayer()` 추가
- `tactical.service.ts`: `listForPlayer()`, `getByIdForPlayer()`, `resolvePlayerId()` 추가
- `tactical.controller.ts`: list/getById에 PLAYER 역할 분기

**i18n:**
- `ko/en match.json`: `playerDescription` 키 추가

---

### PR #189 — feat/squad-plan-save: 스쿼드 플래너 저장
**목적:** 포메이션 배치 영구 저장 + 자동 복원

**변경 내용 (백엔드):**
- `schema.prisma`: `SquadPlan` 모델 (seasonId unique, slots Json)
- `squad-plan.repo.ts` (신규): upsert
- `squad-plan.service.ts` (신규): get, save
- `squad-plan.controller.ts` (신규): GET/PUT, HEAD_COACH 저장 권한
- `apiRouter.ts`: `/squad-plan` 라우트 등록

**변경 내용 (프론트엔드):**
- `squadPlan.service.ts` (신규): `squadPlanApi.get()`, `squadPlanApi.save()`
- `SquadPlannerPage.tsx`: 저장 버튼, `isDirty` 상태, 마운트 시 자동 복원, `skipRebuildRef` 패턴

**i18n:**
- `ko/en squad.json`: `planner.save`, `planner.saving`, `planner.saveSuccess`, `planner.saveFailed`, `planner.saveNoSeason` 추가

---

## 페르소나 리뷰 결과

### Ash (UX/UI 디자이너) — 리뷰 및 수정 완료

| PR | 이슈 | 심각도 | 조치 |
|----|------|--------|------|
| #186 | InjuryStatusBox UUID 노출 | High | ✅ 수정 완료 (ab1963d) |
| #186 | CoachQuickView i18n 누락 | High | ✅ 수정 완료 (ab1963d) |
| #186 | skeleton 높이 불일치 | Medium | 향후 검토 |
| #187 | 계약 숨김 시 그리드 비대칭 | Medium | ✅ 수정 완료 (496184f) |
| #188 | PLAYER 행 onClick 잔류 | Medium | 향후 검토 |
| #189 | 포메이션 변경 시 dirty 경고 없음 | Medium | 향후 검토 |
| #189 | 페이지 이탈 방지 없음 (useBlocker) | Medium | 향후 검토 |

### 박지성 (FC Seoul 감독) — 현장 피드백

**해결된 사항:**
- ✅ 훈련 결석자 3-box로 즉시 확인 가능
- ✅ 다음 경기 D-Day + 상대팀 표시
- ✅ 장비 메뉴 COACHING_STAFF에서 제거
- ✅ 선수 상세 페이지에서 계약/급여 정보 숨김
- ✅ 스쿼드 플래너 저장/복원 구현

**아직 해결되지 않은 사항:**
- ❌ 전술 분석: HEAD_COACH도 클릭하면 수정 폼이 열림 (읽기 전용 뷰 미구현)
- ❌ 복귀 임박 부상자 강조 표시 없음
- ❌ 출결 컬럼 설명/단순화 미구현

---

## 페르소나 분석 요약 (persona-analysis-summary.md 기준)

### Critical — 구현 완료된 항목
| 항목 | PR |
|------|----|
| KPI 드릴다운 (공지 열람률·출석률) | #183 |
| 계약 만료 자동 알림 (90/60/30일) | #182 |
| 스쿼드 플래너 저장 | #189 |
| 감독 대시보드 3-box | #186 |

### 남은 Critical 항목
| 항목 | 지적 페르소나 | 상태 |
|------|--------------|------|
| 통합 P&L / Executive Dashboard | Rooney, Jack | 미구현 |
| 출결·수정 감사 로그 + 소명 워크플로우 | 이연주, Steve | 미구현 |
| 역할별 화면 단순화 (감독용) | 박지성, Mark | 부분 완료 |
| 장비 반납 버튼 텍스트 버그 | David Park, Pedro | 미구현 |
| 시설 점검 실패 → 유지보수 자동 연결 | David Park, Pedro | 미구현 |
| 장비 유닛 assignedTo select 누락 | Pedro | 미구현 |

---

## 다음 우선순위 제안

1. **HEAD_COACH 전술 분석 읽기 전용 뷰** — 박지성 고통점 #6 미해결
2. **장비 반납 버튼 텍스트 버그** (`rejectButton` 키 오용) — David Park + Pedro 공통 지적
3. **시설 점검 실패 → MaintenanceRequest 자동 생성** — David Park + Pedro 공통
4. **SquadPlannerPage `useBlocker`** — Ash Medium 이슈 (이탈 방지)

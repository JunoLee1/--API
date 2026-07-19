# 코치 역할 최적화 — 설계 스펙

**날짜:** 2026-07-19  
**범위:** 수비/공격/골키퍼 코치 업무 최적화 (Frontend 전용, BE 변경 없음)  
**관련 컨텍스트:** CONTEXT.md §코칭스태프 역할, §포지션

---

## 배경

PR #34에서 CoachingRole → SessionType pre-fill이 완료되었다.  
이번 스펙은 그 위에 3가지 기능을 추가하여 코치별 워크플로우를 완성한다.

1. TrainingDetailPage 포지션 필터링
2. TrainingPage 미니 캘린더 사이드바
3. CoachDashboardPage (시각화 + 보고서 내보내기)

---

## Feature 1 — 포지션 필터링 (TrainingDetailPage)

### CoachingRole → Position 매핑

파일: `football/src/lib/coachPositionMap.ts` (신설)

```ts
export const COACH_POSITION_MAP: Partial<Record<CoachingRole, Position[]>> = {
  DEFENSIVE_COACH: [
    'center_back', 'left_wing_back', 'left_full_back',
    'right_wing_back', 'right_full_back',
  ],
  ATTACKING_COACH: [
    'striker', 'shadow_striker', 'winger',
    'central_attack_midfielder', 'right_attack_midfielder', 'left_attack_midfielder',
  ],
  GOALKEEPER_COACH: ['goalkeeper'],
}
```

HEAD_COACH, ASSISTANT_COACH, PHYSICAL_COACH, SET_PIECE_COACH는 맵에 없으므로 전체 노출 (필터 없음).

### UX 동작

- **담당 포지션 행:** 정상 표시, 출석·점수·피드백 입력 가능
- **비담당 포지션 행:** 행 전체 `opacity-40` + 포인터 이벤트 차단 (읽기 전용)
- **"전체 보기" 토글 ON:** opacity-40 제거, 행 정상 표시 — 단, 비담당 포지션 점수 입력은 여전히 비활성화 (시각적 강조만 해제)
- **토글 기본값:** OFF (필터 ON, 담당 포지션만 정상 표시)
- **상태 저장:** localStorage에 토글 상태 유지 (페이지 재방문 시 유지)

> **참고:** CONTEXT.md §훈련에 "담당 코치는 포지션 구분 없이 세션 참가자 전원 평가 가능"이라고 명시되어 있으나, 이 스펙은 UX 집중도를 위해 시각적 포지션 필터를 추가한다. 백엔드 권한은 변경하지 않는다.

### 변경 파일

- `football/src/lib/coachPositionMap.ts` — 신설
- `football/src/pages/training/TrainingDetailPage.tsx` — 필터 로직 + 토글 UI 추가

---

## Feature 2 — 미니 캘린더 사이드바 (TrainingPage)

### 레이아웃

```
┌────────────────┬──────────────────────────────────────────┐
│  < 2026년 7월 >│  세션 목록 (기존)                         │
│  일 월 화 수 목 금 토│                                    │
│  .  .  .  1  2  3  4│  ┌──────────────────────────────┐  │
│  5  6  7  8  9  10 11│  │ 07/18 전술 수비  PENDING     │  │
│  12 13 14 15 16 17 [18]│ │ 07/17 체력 훈련  APPROVED    │  │
│  ...               │  └──────────────────────────────┘  │
└────────────────┴──────────────────────────────────────────┘
```

### 동작

- 세션이 존재하는 날짜 → 날짜 아래 소형 dot 표시 (세션 수 무관)
- 날짜 클릭 → 해당 날짜 세션만 필터링 (URL 쿼리 파라미터: `?date=YYYY-MM-DD`)
- 선택된 날짜 재클릭 → 필터 해제 (전체 목록)
- 이전/다음 달 네비게이션 → dot 표시 재계산
- 모바일: 캘린더 사이드바를 접을 수 있는 토글 버튼

### 구현 방식

shadcn/ui `Calendar` 컴포넌트를 기반으로 커스텀 `modifier`를 주입하여 dot 표시.  
`react-day-picker`가 이미 shadcn 의존성에 포함되어 있어 별도 설치 불필요.

### 변경 파일

- `football/src/pages/training/TrainingPage.tsx` — 레이아웃을 `flex` 2컬럼으로 변경 + 캘린더 사이드바 추가
- `football/src/components/ui/mini-calendar.tsx` — 신설 (재사용 가능한 컴포넌트)

---

## Feature 3 — 코치 대시보드 페이지

### 라우트

`/training/dashboard`  
접근 권한: `COACHING_STAFF` 역할만 (훈련 메뉴에서 링크 추가)

### 레이아웃

```
┌─── 코치 대시보드 ──────────────────────────────────────────────┐
│  기간: [이번 달 ▼]   포지션: [내 담당 ▼ / 전체]               │
├────────────────────────┬───────────────────────────────────────┤
│  포지션별 평균 점수    │  세션별 출석률 추이                    │
│  [BarChart — recharts] │  [LineChart — recharts]               │
├────────────────────────┴───────────────────────────────────────┤
│  선수별 점수 추이                                               │
│  [MultiLineChart — 선수별 색상, 최대 10명]                     │
├─────────────────────────────────────────────────────────────────┤
│  [📋 슬랙용 복사]  [📄 이메일용 복사]  [🖨 PDF 인쇄]          │
└─────────────────────────────────────────────────────────────────┘
```

### 데이터 소스

기존 API 재활용 (BE 변경 없음):
- `trainingApi.getResults({ from, to })` — 점수 데이터
- `trainingApi.getSessions({ from, to })` — 세션 목록

FE에서 포지션 그룹 집계 처리.

### 슬랙용 복사 포맷

```
📊 *[{월} 훈련 리포트]* — {코치명} ({역할})
📅 기간: {from} – {to} | 세션 수: {N}회
━━━━━━━━━━━━━━━━━━━━
👥 포지션별 평균 점수
{포지션 그룹별 이모지 + 이름}: {평균 점수}
📋 출석률: {전체 출석률}%
⚠️ 누락 데이터: {미평가 선수 목록, 없으면 없음}
```

`navigator.clipboard.writeText()` 로 클립보드 복사 후 toast 알림.

### 이메일용 복사 포맷

```
제목: [{월} 훈련 결과 보고] {코치명}

[요약]
기간: {from} ~ {to}, 총 {N}회 세션 진행

[포지션별 지표]
포지션       평균 점수   출석률
---------   --------   ------
{포지션}     {점수}     {출석률}%

[코치 코멘트]
(작성 필요)

[누락 데이터 알림]
{미평가 선수 목록}
```

동일하게 클립보드 복사.

### PDF 인쇄

`window.print()` + `@media print` CSS:
- 버튼/네비게이션 숨김
- 차트(SVG)는 인쇄 시 그대로 렌더링 (recharts SVG 기반)
- 헤더에 기간, 코치명, 날짜 자동 삽입

### 변경 파일

- `football/src/pages/training/CoachDashboardPage.tsx` — 신설
- `football/src/services/training.service.ts` — 필요 시 경량 집계 헬퍼 추가
- `football/src/App.tsx` (또는 라우터 파일) — `/training/dashboard` 라우트 추가
- 훈련 메뉴 네비게이션 — "코치 대시보드" 링크 추가

---

## 구현 순서

| PR | 기능 | 파일 |
|----|------|------|
| #35 | 포지션 필터링 | coachPositionMap.ts + TrainingDetailPage.tsx |
| #36 | 미니 캘린더 | mini-calendar.tsx + TrainingPage.tsx |
| #37 | 코치 대시보드 + 보고서 | CoachDashboardPage.tsx + 라우터 |

각 PR은 독립적으로 동작하며 롤백 가능.

---

## 미결 사항

없음. 모든 데이터 소스 확인 완료, BE 변경 불필요.

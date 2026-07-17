# MatchDetailPage Fotmob 스타일 리뉴얼

**날짜:** 2026-07-17
**범위:** `football/src/pages/matches/MatchDetailPage.tsx` 단일 파일 UI 개선

---

## 목표

현재 숫자 카드 나열 방식의 경기 상세 페이지를 Fotmob 스타일로 개선한다.
데이터 모델·API·라우트 변경 없음. 순수 UI 레이어 변경.

---

## 디자인 방향: B — 라이트 + 컬러 비교 바

앱 전체 라이트 톤 유지, 스코어 헤더만 그라디언트 강조.

---

## 섹션별 명세

### 1. 스코어 헤더

- 배경: `linear-gradient(135deg, #1d4ed8, #7c3aed)` (파랑→보라)
- 좌: 홈팀명 + "홈" 레이블 (white)
- 중앙: 스코어 박스 (`bg-white/10 rounded-xl`) — 스코어 30px bold + FT/승/무/패 배지
  - 결과 배지: 승 `text-green-400`, 무 `text-slate-300`, 패 `text-red-400`
  - 스코어 없을 때: `"vs"` + 예정 날짜 표시
- 우: 원정팀명 + "원정" 레이블
- 상단 인라인: 대회 타입 배지 + 날짜

### 2. 팀 통계 비교 바 (`TeamStatsBar` 컴포넌트)

팀 통계(`teamMatchStats`)가 있을 때만 렌더링.

**레이아웃 (행별):**
```
[홈값 bold 파랑] [레이블 중앙] [원정값 bold 빨강]
[━━━━━━████░░░░░░━━━━━━━━━━]  ← 분할 바
```

**표시 지표 (순서):**
1. 점유율 (`possession %`)
2. 슈팅 — 부제: `유효 N회`
3. 패스 성공률 (`passAccuracy %`)
4. xG — 홈쪽 바는 초록(`#10b981`), 원정은 빨강

**바 색상:**
- 홈: `#2563eb` (파랑)
- 원정: `#dc2626` (빨강)
- xG 홈: `#10b981` (초록)

### 3. 보조 통계 칩 그리드 (3열)

팀 통계가 있을 때만.
코너킥 / 경고(황색) / 파울 — 각 `rounded-lg border bg-card` 칩.
경고는 숫자를 `text-amber-500`으로 강조.

### 4. 선수 기록 테이블

- 현재 테이블 구조 유지, 스타일 개선
- 헤더: uppercase, 9px, slate-400
- 득점 > 0: `font-bold text-slate-900`
- xG: 1.5 이상 `text-emerald-600 font-semibold`, 미만 `text-slate-400`
- 출전 시간: `text-slate-400 tabular-nums`

---

## 구현 범위

**수정 파일 1개:**
- `football/src/pages/matches/MatchDetailPage.tsx`

**신규 추출 컴포넌트 (파일 내 로컬):**
- `TeamStatsBar` — 지표 이름·홈값·원정값·전체합을 받아 비교 바 렌더링
- 기존 `StatCard` 제거 (보조 칩으로 대체)

**변경 없음:**
- BE API, 라우트, 타입, 시드 데이터

---

## 데이터 의존성

| 섹션 | 데이터 소스 | 없을 때 |
|------|------------|---------|
| 스코어 헤더 | `match.homeScore / awayScore` | `"vs"` 표시 |
| 팀 통계 바 | `match.teamMatchStats` | 섹션 숨김 |
| 선수 기록 | `match.playerMatchStats` | 섹션 숨김 |

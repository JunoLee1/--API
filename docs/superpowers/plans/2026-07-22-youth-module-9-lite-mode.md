# 유소년 모듈 Plan 9: 소규모 구단 Lite Mode 지원

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 선수 10명 이하·코치 2명 이하 등 소규모 구단이 복잡한 ERP 기능 없이 핵심 기능만 경량 운영할 수 있도록 Lite Mode를 지원한다. 구단(Team)별 플래그로 활성화하며, FE는 비활성 메뉴를 숨기고 BE는 LITE 전용 간소화 API를 제공한다.

> **✅ 그릴 결정사항 (2026-08-19):** Lite Mode = **회비/결제 기능만 차단**. 라인업·PDI·외부보고서·알림은 lite에서도 허용 (학교팀도 동아리 수준이 아니면 이 기능들 필요). 학교팀 = `Club.isLite:true`로 생성. `Team.isLite`는 Club cascade로 동기화 (club-gm-hierarchy 플랜 참조). 현재 academy-fees nav 1개만 `liteBlocked`인 구현이 이미 정답.

**Architecture:**
- `Team.isLite boolean` 플래그로 구단 단위 활성화
- FE: `useLiteMode()` hook → `AppShell` 메뉴 필터링, 복잡 페이지 접근 시 안내 배너
- BE: LITE 구단에서만 접근 가능한 간소화 엔드포인트 (수동 출석 일괄 입력, 간단 스쿼드 관리)
- 어드민이 Team.isLite 토글 가능 (PATCH /teams/:id 기존 엔드포인트 재활용)

**LITE 모드에서 비활성화되는 기능:**
- 라인업 드래그앤드롭 (MatchLineupPage) → 간소화 스쿼드 지정으로 대체
- PDI 차트 / 포지션 다양성 분석
- 외부 보고서 자동 생성 (ExternalReport)
- 아카데미 회비 자동 청구 cron (Plan 8) → 수동 납부 기록만 허용
- 주간 일정 cron 알림 → 단건 알림만 사용

**Tech Stack:** Prisma migration, Express BE, React FE, Tailwind

**의존성:** Plans 1–5 완료 필요

---

## 파일 맵

### BE — 신규
- `apps/api/src/team/dto/team-lite.dto.ts`
- `apps/api/__test__/team/team-lite.test.ts`

### BE — 수정
- `apps/api/prisma/schema.prisma` — `Team.isLite Boolean @default(false)` 추가
- `apps/api/prisma/migrations/YYYYMMDD_add_team_is_lite/` — migration 파일
- `apps/api/src/team/team.repo.ts` — `updateLiteFlag(teamId, isLite)` 추가
- `apps/api/src/team/team.service.ts` — `setLiteMode(teamId, isLite, requesterRole)` 추가 (ADMIN만 허용)
- `apps/api/src/team/team.controller.ts` — `PATCH /teams/:id/lite` 핸들러 추가
- `apps/api/src/team/team.routes.ts` — 라우트 등록
- `apps/api/src/match/match.lineup.service.ts` — LITE 구단 saveLineup 시 간소화 검증만 실행 (포메이션 강제 없음)

### FE — 신규
- `football/src/hooks/useLiteMode.ts` — `useCurrentTeam()` + teamApi로 isLite 조회, boolean 반환
- `football/src/components/ui/LiteModeGate.tsx` — `<LiteModeGate blocked>` 래퍼: LITE면 배너 표시, 아니면 children 렌더
- `football/src/services/teamAdmin.service.ts` — `teamAdminApi.setLite(teamId, isLite)`

### FE — 수정
- `football/src/layouts/AppShell.tsx` — `useLiteMode()`로 숨길 nav 항목 필터링 (라인업, PDI, ExternalReport, AcademyFee 청구)
- `football/src/pages/matches/MatchLineupPage.tsx` — LITE 모드 안내 배너 + 드래그앤드롭 비활성화
- `football/src/pages/players/PlayerDetailPage.tsx` — PDI 섹션 `<LiteModeGate blocked>` 래핑
- `football/src/types/team.ts` — `Team.isLite: boolean` 필드 추가
- `football/src/pages/admin/TeamSettingsPage.tsx` — Lite Mode 토글 스위치 UI (ADMIN 전용)

---

## Task 1 — BE: Team.isLite 스키마 + 마이그레이션

- [x] `apps/api/prisma/schema.prisma`에 `isLite Boolean @default(false)` 추가
- [x] `prisma migrate dev --name add_team_is_lite` 실행 (shadow DB 문제 시 db push + migrate resolve 워크어라운드)
- [x] `apps/api/src/team/team.repo.ts`에 `updateLiteFlag(teamId: number, isLite: boolean)` 추가
  ```ts
  updateLiteFlag(teamId: number, isLite: boolean) {
    return this.prisma.team.update({ where: { id: teamId }, data: { isLite } });
  }
  ```
- [x] `apps/api/__test__/team/team-lite.test.ts` — `updateLiteFlag` 단위 테스트 (Jest)

## Task 2 — BE: setLiteMode Service + Controller + Routes

- [x] `apps/api/src/team/team.service.ts`에 `setLiteMode(teamId, isLite, requesterRole)` 추가
  - `requesterRole !== 'ADMIN'` → `AppError(403, 'FORBIDDEN')`
  - 존재하지 않는 팀 → `AppError(404, 'TEAM_NOT_FOUND')`
- [x] `apps/api/src/team/team.controller.ts`에 `PATCH /teams/:id/lite` 핸들러 추가
  ```ts
  // PATCH /teams/:id/lite  body: { isLite: boolean }
  async setLiteMode(req, res) {
    const result = await service.setLiteMode(+req.params.id, req.body.isLite, req.user.role);
    res.json(result);
  }
  ```
- [x] `apps/api/src/team/team.routes.ts`에 라우트 등록 (ADMIN 전용 미들웨어)

## Task 3 — FE: useLiteMode hook + teamAdmin service

- [x] `football/src/services/teamAdmin.service.ts` 신규 생성
  ```ts
  import { api } from './api'
  export const teamAdminApi = {
    setLite: (teamId: number, isLite: boolean) =>
      api.patch(`/teams/${teamId}/lite`, { isLite }).then(r => r.data),
  }
  ```
- [x] `football/src/hooks/useLiteMode.ts` 신규 생성
  ```ts
  // 현재 로그인 유저의 팀 isLite 값 반환
  // useCurrentUser() → teamId → teamApi.getById(teamId) → isLite
  export function useLiteMode(): boolean
  ```
- [x] `football/src/types/team.ts`에 `isLite: boolean` 필드 추가

## Task 4 — FE: LiteModeGate 컴포넌트

- [x] `football/src/components/ui/LiteModeGate.tsx` 신규 생성
  ```tsx
  // blocked=true: LITE 구단이면 안내 배너, 아니면 children
  // blocked=false: 항상 children (LITE 전용 콘텐츠 표시용)
  export function LiteModeGate({ blocked, children }: { blocked: boolean; children: ReactNode })
  ```
  - 배너 문구: "이 기능은 Lite Mode 구단에서 사용할 수 없습니다."

## Task 5 — FE: AppShell 메뉴 필터링

- [x] `football/src/layouts/AppShell.tsx`에 `useLiteMode()` 호출
- [x] LITE 시 숨길 nav 항목 목록:
  - "라인업 관리" (MatchLineupPage 경로)
  - "포지션 다양성" (PDI)
  - "외부 보고서" (ExternalReport)
  - "회비 관리" (AcademyFee) — Plan 8 구현 후 적용
- [x] 숨기는 방식: nav 배열 filter (hidden 속성 추가 아닌 조건부 제거)

## Task 6 — FE: 기존 페이지 LITE 게이트 적용

- [x] `football/src/pages/matches/MatchLineupPage.tsx`
  - isLite면 상단에 `<LiteModeGate blocked>` 배너 표시
  - 드래그앤드롭 핸들러 비활성화 (isLite && 저장 버튼 비활성)
- [x] `football/src/pages/players/PlayerDetailPage.tsx`
  - PDI 섹션: `<LiteModeGate blocked><PositionDiversityChart /></LiteModeGate>`

## Task 7 — FE: TeamSettingsPage Lite Mode 토글 (ADMIN 전용)

- [x] `football/src/pages/admin/TeamSettingsPage.tsx` 신규 또는 기존 수정
  - ADMIN 역할만 접근 가능 (`useCurrentUser().role !== 'ADMIN'` → 리다이렉트)
  - Lite Mode 토글 스위치: 현재 `team.isLite` 표시, 변경 시 `teamAdminApi.setLite()` 호출
  - 성공 시 toast "Lite Mode 설정이 변경되었습니다."
- [x] `football/src/App.tsx`에 `/admin/team-settings` 라우트 추가
- [x] AppShell ADMIN 전용 nav에 "구단 설정" 항목 추가

---

## 스펙 준수 체크리스트 (구현 후 검토)

- [x] `Team.isLite` 기본값 `false` — 기존 구단 무영향
- [x] ADMIN 아닌 역할이 PATCH /teams/:id/lite 호출 시 403
- [x] LITE 구단 AppShell에서 제외된 메뉴 4개 확인
- [x] 비LITE 구단에서 LiteModeGate blocked 섹션 → children 정상 표시
- [x] Team.isLite FE 타입 누락 없음 (TypeScript 컴파일 에러 없음)

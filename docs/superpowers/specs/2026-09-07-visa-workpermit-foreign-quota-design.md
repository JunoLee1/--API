# 비자·노동허가·외국인 쿼터 관리 설계

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 외국인 선수 영입 흐름에서 쿼터 초과 차단, 비자 불확실 시 계약 진입 차단, 서명 후 노동허가 상태 업데이트 기능을 추가한다.

**Architecture:** 기존 `Prospect.visaEligibility`, `Player.workPermitStatus` 필드를 활용해 서비스 레이어에 게이트를 추가하고, 새 엔드포인트로 노동허가 업데이트를 지원한다. 쿼터 규정은 리그명 기준 상수로 하드코딩한다.

**Tech Stack:** Express + Prisma + React/Vite (기존 스택)

---

## 1. 외국인 선수 쿼터

### 규정 (K리그 하드코딩)

| 리그 | 등록 상한 |
|------|---------|
| K리그1 | 5명 |
| K리그2 | 4명 |
| K리그3 | 무제한 |

경기당 출전 쿼터(3+1 등)는 경기 관리 도메인 — 이번 범위 외.

### 외국인 선수 판별

`Player.workPermitStatus !== 'NOT_REQUIRED'` → 외국인 선수로 간주.

### 시행 위치

`ProspectService.sign()` — Prospect → Player 전환 시점:
1. 현재 활성 시즌의 리그명 조회
2. 해당 리그 쿼터 상수 조회
3. 현재 스쿼드의 외국인 선수 수 카운트
4. `count >= limit` → `409 FOREIGN_QUOTA_EXCEEDED`
5. `visaRequired = true`이고 전환 후 `workPermitStatus`가 NOT_REQUIRED가 아닌 경우에만 카운트 대상 포함

### 새 파일

`apps/api/src/lib/foreign-quota.ts`:
```ts
export const FOREIGN_QUOTA: Record<string, number> = {
  'K리그1': 5,
  'K리그2': 4,
  'K리그3': Infinity,
}
export function getForeignQuota(leagueName: string): number {
  return FOREIGN_QUOTA[leagueName] ?? Infinity
}
```

---

## 2. 비자 적격성 게이트

### 규칙

`ProspectService.updateStatus()` 내 `→ CONTRACT_PENDING` 전환 시:
- `prospect.visaRequired === true` AND `prospect.visaEligibility === 'UNCERTAIN'`
  → `400 VISA_ELIGIBILITY_UNCERTAIN`

`NOT_REQUIRED` 또는 `CONFIRMED`이면 통과.

### FE 처리

`ProspectDetailSheet.tsx` 상태 전환 실패 시 에러 코드 `VISA_ELIGIBILITY_UNCERTAIN` → toast "비자 취득 가능성이 불확실합니다. visaEligibility를 확인 후 진행하세요."

---

## 3. 노동허가 상태 업데이트

### 엔드포인트

`PATCH /players/:id/work-permit`

**Request body:**
```ts
{
  workPermitStatus: WorkPermitStatus  // PENDING | APPROVED | REJECTED
  workPermitExpiry?: string           // ISO date, APPROVED 시 필수
}
```

**Response:** 업데이트된 Player 객체 (workPermitStatus, workPermitExpiry 포함)

**권한:** `isAdminLike(role)` OR `role === 'GM'` OR `(role === 'FRONT_OFFICE' && (frontOfficeRole === 'TD' || frontOfficeRole === 'CONTRACT_MANAGER'))`

**검증:**
- `workPermitStatus === 'APPROVED'` → `workPermitExpiry` 필수 (없으면 `400 EXPIRY_DATE_REQUIRED`)
- `workPermitStatus === 'NOT_REQUIRED'` 전환 불가 (서명 시점에만 설정 가능)

### 서비스/레포

`PlayerService.updateWorkPermit(playerId, dto)` — 기존 player 서비스에 메서드 추가.
`PlayerRepo.updateWorkPermit(playerId, data)` — Prisma update.

### FE

**위치:** `PlayerDetailPage.tsx` 기존 선수 정보 섹션 내 Work Permit 카드.

**컴포넌트:**
- 현재 상태 배지 (NOT_REQUIRED / PENDING / APPROVED / REJECTED)
- 드롭다운: PENDING → APPROVED / REJECTED 선택
- APPROVED 선택 시 만료일 datepicker 노출
- [저장] 버튼 → `PATCH /players/:id/work-permit`
- 권한 없는 사용자에게는 읽기 전용 표시

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `src/lib/foreign-quota.ts` | 신규 — 쿼터 상수 |
| `src/prospect/prospect.service.ts` | `sign()` 쿼터 체크 추가, `updateStatus()` 비자 게이트 추가 |
| `src/prospect/prospect.repo.ts` | `countForeignPlayers(seasonId)` 추가 |
| `src/player/player.service.ts` | `updateWorkPermit()` 추가 |
| `src/player/player.repo.ts` | `updateWorkPermit()` 추가 |
| `src/player/player.controller.ts` | `PATCH /:id/work-permit` 핸들러 추가 |
| `src/player/player.routes.ts` | 라우트 등록 |
| `football/src/pages/players/PlayerDetailPage.tsx` | Work Permit 카드 + 업데이트 UI |
| `football/src/pages/prospects/ProspectDetailSheet.tsx` | `VISA_ELIGIBILITY_UNCERTAIN` 에러 메시지 처리 |
| `football/src/services/player.service.ts` | `updateWorkPermit()` API 호출 추가 |

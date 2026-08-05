# Guardian(유소년 학부모) Feature Design

**Date:** 2026-08-05  
**Issues:** #127, #128, #129, #130  
**Branch:** feat/guardian-feature

---

## 1. 목표

GUARDIAN 역할 유저가 자녀(Player)를 연동한 뒤, 자녀의 경기·훈련·성장·부상·납부 현황을 조회하고 중요 이벤트(부상, 1군 콜업) 시 인앱+이메일 알림을 받는 기능.

---

## 2. 아키텍처

### 신규 모듈: `src/guardian/`

```
src/guardian/
├── guardian.routes.ts
├── guardian.controller.ts
├── guardian.service.ts
├── guardian.repo.ts
├── guardian.middleware.ts
└── dto/
    └── guardian.dto.ts
```

### 권한 흐름

```
요청
→ auth (JWT 검증, 비로그인 401)
→ requireRole('GUARDIAN') (GUARDIAN 아닌 역할 403)
→ requireGuardianChild (내 자녀 아닌 접근 403)
→ controller
```

`requireGuardianChild`: `Player.guardianId === req.user.id` 검증. 자녀가 없거나 다른 guardian 소속이면 403.

---

## 3. API

### 자녀 연동 (인증 후, guardian 미들웨어 전)

| Method | Path | 설명 |
|---|---|---|
| POST | `/guardian/link/search` | 학생코드+이름+생년월일로 자녀 연동 |
| POST | `/guardian/link/code` | 초대 코드로 자녀 연동 |
| POST | `/guardian/invite-code` | 초대 코드 발급 (ADMIN·FRONT_OFFICE·GM 전용) |

### 자녀 정보 조회 (requireGuardianChild 통과 필요)

| Method | Path | 설명 |
|---|---|---|
| GET | `/guardian/me/child` | 자녀 기본 정보 |
| GET | `/guardian/me/dashboard` | 풀패키지 대시보드 |
| GET | `/guardian/me/child/schedule` | 다음 7일 경기·훈련 일정 |
| GET | `/guardian/me/child/attendance` | 현 시즌 출결 현황 |
| GET | `/guardian/me/child/growth` | 최신 성장평가 + 활성 발달계획 |
| GET | `/guardian/me/child/injuries` | 부상 이력 (활성 + 과거) |
| GET | `/guardian/me/child/stats` | 최근 경기 스탯 + 시즌 평균 |
| GET | `/guardian/me/child/fees` | 납부 현황 (pending·overdue) |

---

## 4. 자녀 연동 상세

### 방식 A — 학생코드 검색 (`POST /guardian/link/search`)

```
body: { studentCode, playerName, dateOfBirth }

1. Player WHERE studentCode + playerName + dateOfBirth 모두 일치
2. 없음 → 404 PLAYER_NOT_FOUND
3. guardianId가 이미 다른 user → 409 ALREADY_LINKED
4. 성공 → Player.guardianId = req.user.id
```

### 방식 B — 초대 코드 (`POST /guardian/link/code`)

```
body: { code }

1. GuardianInviteCode WHERE code
2. 없음 → 404 INVALID_CODE
3. usedAt != null → 409 CODE_ALREADY_USED
4. expiresAt < now → 410 CODE_EXPIRED
5. 성공 → Player.guardianId = req.user.id
         GuardianInviteCode.usedById = req.user.id
         GuardianInviteCode.usedAt = now
```

### 초대 코드 발급 (`POST /guardian/invite-code`)

```
body: { playerId }
권한: ADMIN | FRONT_OFFICE | GM

- 동일 playerId의 미사용·미만료 코드가 있으면 재발급 없이 기존 코드 반환
- 없으면 8자리 랜덤 영숫자 생성, expiresAt = now + 72h
```

---

## 5. 대시보드 응답 구조

`GET /guardian/me/dashboard`

```ts
{
  child: {
    id: string
    playerName: string
    position: Position
    level: PlayerLevel
    teamName: string
  }
  upcoming: {
    matches: { id, date, homeTeamName, awayTeamName }[]   // 다음 7일
    sessions: { id, date, sessionType }[]
  }
  attendance: {
    total: number
    attended: number
    absent: number
    late: number
  }
  growth: {
    latestEvaluation: GrowthEvaluation | null
    activeDevelopmentPlan: PlayerDevelopmentPlan | null
  }
  injuries: {
    active: Injury[]
    history: Injury[]
  }
  stats: {
    lastMatch: PlayerMatchStats | null
    seasonAvg: { goals, assists, passingAccuracy, ... } | null
  }
  fees: {
    pending: AcademyFee[]
    overdue: AcademyFee[]
  }
}
```

---

## 6. 알림

### 부상 알림 — `InjuryReport` service에 추가

트리거: `InjuryReport` 상태가 `SUBMITTED`로 전환될 때

```
1. Player.guardianId 조회
2. guardianId가 있으면:
   - Notification 생성 (type: GUARDIAN_CHILD_INJURY, userId: guardianId)
   - sendGuardianInjuryEmail(guardianEmail, playerName, injuryDescription)
```

### 콜업 알림 — `PlayerCallup` service에 추가

트리거: `PlayerCallup` 상태가 `APPROVED`로 전환될 때

```
1. Player.guardianId 조회
2. guardianId가 있으면:
   - Notification 생성 (type: GUARDIAN_CHILD_CALLUP, userId: guardianId,
                        body: requiredDocuments 포함)
   - sendGuardianCallupEmail(guardianEmail, playerName, requiredDocuments)
```

---

## 7. 에러 코드

| 상황 | HTTP | 코드 |
|---|---|---|
| 비로그인 | 401 | UNAUTHORIZED |
| GUARDIAN 아닌 역할이 guardian API 접근 | 403 | FORBIDDEN |
| 내 자녀 아닌 player 접근 | 403 | FORBIDDEN |
| 없는 player (학생코드 검색 실패) | 404 | PLAYER_NOT_FOUND |
| 없는 초대 코드 | 404 | INVALID_CODE |
| 이미 다른 guardian에 연동된 자녀 | 409 | ALREADY_LINKED |
| 이미 사용된 초대 코드 | 409 | CODE_ALREADY_USED |
| 만료된 초대 코드 | 410 | CODE_EXPIRED |

---

## 8. 기존 모듈 변경 범위

| 파일 | 변경 내용 |
|---|---|
| `src/lib/permissions.ts` | GUARDIAN 권한 정의 추가 |
| `src/injury-report/injury-report.service.ts` | SUBMITTED 전환 시 guardian 알림 trigger |
| `src/callup/callup.service.ts` | APPROVED 전환 시 guardian 알림 trigger |
| `src/lib/email.ts` | sendGuardianInjuryEmail, sendGuardianCallupEmail 추가 |
| `src/server.ts` | guardian 라우터 등록 |

---

## 9. 구현 순서

1. `guardian.middleware.ts` — requireRole, requireGuardianChild
2. `guardian.repo.ts` + `guardian.service.ts` — 자녀 연동 (link/search, link/code)
3. `guardian.service.ts` — 초대 코드 발급
4. `guardian.repo.ts` + `guardian.service.ts` — 대시보드 집계
5. `email.ts` — guardian 알림 이메일 템플릿
6. InjuryReport service — 부상 알림 trigger
7. PlayerCallup service — 콜업 알림 trigger
8. `guardian.routes.ts` + `server.ts` 등록

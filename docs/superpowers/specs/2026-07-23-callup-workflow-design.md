# 유소년 콜업 워크플로우 확장 설계

## 개요

기존 `HEAD_COACH → GM` 단순 승인 흐름에 서류 수집 단계를 추가한다.  
유소년 감독과 의무팀이 각각 독립적으로 확인하면 GM에게 최종 승인 요청이 간다.

## 상태 머신

```
REQUESTED ─(youthCoachConfirmed && medicalConfirmed)─► DOCS_SUBMITTED ─(GM 승인)─► APPROVED ─► COMPLETED
                                                                        └─(GM 거절)─► REJECTED
```

- `REQUESTED`: 신청됨. 유소년 감독·의무팀 서류 확인 대기 중.
- `DOCS_SUBMITTED`: 양측 확인 완료. GM 승인 대기 중.
- `APPROVED`: GM 승인. `Player.teamId` 자동 업데이트.
- `REJECTED`: GM 거절. reason 필수.
- `COMPLETED`: HEAD_COACH 또는 GM 수동 완료 처리.

거절은 `DOCS_SUBMITTED` 단계에서만 가능 (기존과 동일하게 approve 전 단계).

## 스키마 변경

### enum 추가

```prisma
enum PlayerCallupStatus {
  REQUESTED
  DOCS_SUBMITTED   // 신규
  APPROVED
  REJECTED
  COMPLETED
}
```

### PlayerCallup 모델 필드 추가

```prisma
model PlayerCallup {
  // 기존 필드 유지
  youthCoachConfirmed Boolean @default(false)
  medicalConfirmed    Boolean @default(false)
}
```

Migration 1개. 기존 레코드(REQUESTED/APPROVED/REJECTED/COMPLETED)는 boolean 기본값 false로 영향 없음.

## API 변경

### 신규 엔드포인트

```
POST /player-callups/:id/confirm-youth
POST /player-callups/:id/confirm-medical
```

**공통 로직:**
1. `status !== 'REQUESTED'`이면 409
2. 권한 체크 (아래 참조)
3. 해당 boolean `true`로 업데이트
4. `youthCoachConfirmed && medicalConfirmed`이면:
   - status → `DOCS_SUBMITTED`
   - GM에게 `CALLUP_DOCS_READY` 알림
   - TD에게 `CALLUP_DOCS_READY` 알림

**권한:**
- `confirm-youth`: `coachingRole === HEAD_COACH` AND `user.teamId === callup.fromTeamId`
- `confirm-medical`: `coachingRole === MEDICAL` (팀 무관)

### 기존 엔드포인트 변경

- `POST /player-callups` (create):
  - 기존 GM 알림 제거
  - fromTeam HEAD_COACH에게 `CALLUP_REQUESTED` 알림 추가
  - MEDICAL 전원에게 `CALLUP_REQUESTED` 알림 추가
  - Guardian 알림 유지

- `POST /player-callups/:id/approve`:
  - 체크 조건 `status !== 'REQUESTED'` → `status !== 'DOCS_SUBMITTED'`로 변경

## 알림 흐름

| 이벤트 | 수신자 | 타입 |
|--------|--------|------|
| 신청 생성 | fromTeam HEAD_COACH | `CALLUP_REQUESTED` |
| 신청 생성 | MEDICAL 전원 | `CALLUP_REQUESTED` |
| 신청 생성 | Guardian (해당 선수) | `CALLUP_REQUESTED` |
| 서류 완료 (DOCS_SUBMITTED) | GM | `CALLUP_DOCS_READY` |
| 서류 완료 (DOCS_SUBMITTED) | TD | `CALLUP_DOCS_READY` |
| 승인 | 신청 HEAD_COACH | `CALLUP_APPROVED` |
| 거절 | 신청 HEAD_COACH | `CALLUP_REJECTED` |

`CALLUP_DOCS_READY`는 `NotificationType` enum에 신규 추가.

fromTeam HEAD_COACH 조회: `notifRepo`에 `createForYouthHeadCoach(fromTeamId, ...)` 헬퍼 추가.  
MEDICAL 전원 알림: `createForMedicalStaff(...)` 헬퍼 추가.

## 프론트엔드 변경

### PlayerCallupPage.tsx

**REQUESTED 상태:**
- 서류 확인 현황 표시: `유소년 감독 ✓/대기`, `의무팀 ✓/대기`
- 로그인 유저 역할에 따라 조건부 버튼:
  - fromTeam HEAD_COACH → "유소년 감독 확인" (이미 확인 시 비활성화)
  - MEDICAL → "의무팀 확인" (이미 확인 시 비활성화)

**DOCS_SUBMITTED 상태:**
- "서류 완료 — GM 승인 대기 중" 뱃지
- GM 로그인 시 승인/거절 버튼 표시

**APPROVED / REJECTED / COMPLETED:** 기존 UI 유지.

### player-callup.service.ts (FE)

`confirmYouth(id)`, `confirmMedical(id)` 메서드 추가.

### player-callup.ts (types)

`youthCoachConfirmed`, `medicalConfirmed` 필드 추가.

## 구현 범위 외

- endDate 자동 복귀 처리 — 기존과 동일하게 수동
- 서류 파일 첨부 — boolean 확인으로 대체, 파일 업로드 없음

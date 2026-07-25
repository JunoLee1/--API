# Report Approval HEAD_COACH Design

## Goal

COACHING_STAFF가 `TRAINING` 타입 보고서를 제출하면 HEAD_COACH가 승인/반려할 수 있도록 프론트엔드를 수정한다.

## Current State

백엔드는 이미 완전히 구현돼 있다:
- `report.repo.ts`: HEAD_COACH면 `{ OR: [{ authorId }, { type: 'TRAINING' }] }` 조회
- `report.controller.ts`: approve/reject 시 `TRAINING` 타입은 `isHeadCoach()` 체크

프론트엔드 3파일만 수정 필요.

## Changes

### 1. `football/src/pages/reports/ReportFormPage.tsx`

`TYPES` 배열에 `'TRAINING'` 추가. COACHING_STAFF가 훈련 보고서 작성 가능.

```tsx
const TYPES: ReportType[] = ['FINANCIAL', 'PERFORMANCE', 'MEDICAL', 'TRAINING']
```

### 2. `football/src/pages/reports/ReportDetailPage.tsx`

HEAD_COACH + TRAINING 조합에 승인/반려 버튼 노출.

```tsx
const isHeadCoach = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH'
const canApprove = (isGM || (isHeadCoach && report.type === 'TRAINING')) && report.status === 'SUBMITTED'
// 버튼 조건: isGM → canApprove
```

### 3. `football/src/pages/reports/ReportsPage.tsx`

HEAD_COACH 역할 감지, 안내 문구 추가.

```tsx
const isHeadCoach = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH'
// 설명: isGM → '전체 목록', isHeadCoach → '훈련 보고서 결재 대기 포함', else → '내가 작성한 보고서'
```

## Out of Scope

- 훈련 결과 탭 변경 (기존 충분)
- 백엔드 변경
- DB 스키마 변경
- 이중 결재 플로우 (HEAD_COACH → GM)

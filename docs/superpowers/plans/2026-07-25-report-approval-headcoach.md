# Report Approval HEAD_COACH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** COACHING_STAFF가 TRAINING 타입 보고서를 제출하고, HEAD_COACH가 승인/반려할 수 있게 프론트엔드 3파일을 수정한다.

**Architecture:** 백엔드는 이미 완전 구현돼 있음. 프론트엔드만 수정. BE 변경/DB 변경 없음.

**Tech Stack:** React, TypeScript

---

### Task 1: 보고서 결재 HEAD_COACH 프론트엔드 수정 (3파일)

**Files:**
- Modify: `football/src/pages/reports/ReportFormPage.tsx` (line 20)
- Modify: `football/src/pages/reports/ReportDetailPage.tsx` (lines 76–77, 155–165)
- Modify: `football/src/pages/reports/ReportsPage.tsx` (lines 37–38, 57–59)

**Context:** 이 레포는 Hono/Express API + React 프론트 + Prisma 구조의 스포츠 ERP다. 보고서 결재 시스템은 `/reports`와 `/reports/:id`에 구현돼 있다. 현재 승인자는 GM(FRONT_OFFICE + frontOfficeRole=GM)만 가능하다. 백엔드는 이미 HEAD_COACH + TRAINING 타입 조합의 결재 로직이 구현돼 있다.

- [ ] **Step 1: ReportFormPage에 TRAINING 타입 추가**

`football/src/pages/reports/ReportFormPage.tsx` line 20:

```tsx
// Before
const TYPES: ReportType[] = ['FINANCIAL', 'PERFORMANCE', 'MEDICAL']

// After
const TYPES: ReportType[] = ['FINANCIAL', 'PERFORMANCE', 'MEDICAL', 'TRAINING']
```

- [ ] **Step 2: ReportDetailPage HEAD_COACH 결재 버튼 추가**

`football/src/pages/reports/ReportDetailPage.tsx`:

line 76 인근 (isGM 선언 바로 아래):
```tsx
const isGM = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'GM'
const isHeadCoach = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH'
const canApprove = (isGM || (isHeadCoach && report?.type === 'TRAINING')) && report?.status === 'SUBMITTED'
```

line 155 인근 버튼 조건 교체:
```tsx
// Before
{isGM && report.status === 'SUBMITTED' && (

// After
{canApprove && (
```

- [ ] **Step 3: ReportsPage HEAD_COACH 안내 문구 추가**

`football/src/pages/reports/ReportsPage.tsx`:

line 37 인근:
```tsx
const isGM = user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'GM'
const isHeadCoach = user?.role === 'COACHING_STAFF' && user?.coachingRole === 'HEAD_COACH'
```

line 57 인근 설명 문구:
```tsx
// Before
{isGM ? 'GM 결재 대기 보고서 포함 전체 목록' : '내가 작성한 보고서 목록'}

// After
{isGM
  ? 'GM 결재 대기 보고서 포함 전체 목록'
  : isHeadCoach
  ? '훈련 보고서 결재 대기 포함 목록'
  : '내가 작성한 보고서 목록'}
```

- [ ] **Step 4: 브라우저에서 동작 확인**

1. COACHING_STAFF로 로그인 → `/reports/new` → 유형에 `훈련` 선택 가능 확인
2. 훈련 보고서 제출 → HEAD_COACH로 로그인 → `/reports` 목록에 해당 보고서 보임 확인
3. 보고서 클릭 → 승인/반려 버튼 노출 확인
4. 승인 클릭 → 상태 `APPROVED` 변경 확인

- [ ] **Step 5: 커밋**

```bash
git add football/src/pages/reports/ReportFormPage.tsx \
        football/src/pages/reports/ReportDetailPage.tsx \
        football/src/pages/reports/ReportsPage.tsx \
        docs/superpowers/specs/2026-07-25-report-approval-headcoach-design.md \
        docs/superpowers/plans/2026-07-25-report-approval-headcoach.md
git commit -m "feat(reports): TRAINING 타입 추가 및 HEAD_COACH 결재 버튼 활성화"
```

# 2026-08-11 세션 요약 — 재무 무결성 + PlanReport 시스템 구현

## 세션 개요

**작업 기간:** 2026-08-10 ~ 2026-08-11  
**브랜치/PR:** #242, #243, #244, #245  
**병합 완료:** 4개 PR → main

---

## 구현된 기능

### PR #242 — feat/sponsorship-roi-alerts: 스폰서십 ROI + 만료 알림

**목적:** 스폰서십 재무 가시성 향상 + 만료 사전 경고

**변경 내용 (백엔드):**
- `GET /sponsorships/roi` — 스폰서 유형별 총 계약금 집계 + 납부 현황 요약
- `GET /sponsorships/expiring` — 90일 이내 만료 예정 스폰서십 목록
- `sponsorshipExpiryAlert.ts` (신규): 매일 오전 9시 node-cron 작업, 만료 30일 전 DB 알림 생성
- `server.ts`: 만료 알림 크론 등록

**변경 내용 (프론트엔드):**
- `SponsorshipPage.tsx` UI 개선 — 필터/페이지네이션 레이아웃 정리

---

### PR #242 (묶음) — 추가 기능들

**budget-auto-generate FE 버튼:**
- `BudgetPage.tsx`: "자동 생성" 버튼 — `POST /budgets/auto-generate` 호출
- 생성 전 확인 다이얼로그, 성공 후 목록 새로고침

**OperatingExpense 시즌 선택:**
- `OperatingExpensePage.tsx`: 상단 시즌 드롭다운 추가
- `operating-expense.routes.ts`: `?seasonId` 쿼리 파라미터 지원

**auth.repo.ts 보안 수정:**
- `createdAt`, `dateOfBirthEncrypted`, `dateOfBirthIv` — 존재하지 않는 필드 참조 제거
- 로그인·토큰 갱신 쿼리 안정화

---

### PR #243 — style: operating-expense.routes.ts 공백 제거

단순 스타일 정리 (trailing whitespace).

---

### PR #244 — docs: 2026년 8월 계획 및 QA 문서

**추가된 문서:**
- `docs/superpowers/plans/2026-08-10-budget-auto-generate.md`
- `docs/superpowers/plans/2026-08-10-meal-to-operating-sponsor-bank.md`
- `docs/superpowers/plans/2026-08-10-plan-report-system.md`
- `docs/superpowers/plans/2026-08-08-finance-integrity.md`
- `docs/qa/배포_수정_요약.md`
- `docs/qa/통합_QA_체크리스트.md`
- `docs/superpowers/specs/2026-08-08-guardian-persona-이승희.md`

---

### PR #245 — feat/plan-report-system: PlanReport 시스템

**목적:** `DepartmentAnnualPlan` 단일 모델을 7개 템플릿 기반의 유연한 계획 결재 시스템으로 교체

**Prisma 스키마 변경:**
- 삭제: `DepartmentAnnualPlan`, `DepartmentBudgetItem`, `DepartmentKpiItem`, `DepartmentReviewerConfig`
- 추가: `PlanReport` 모델, `PlanTemplateType` enum, `ApproverLevel` enum
- `ClubSettings`: `planApprovalLimit Int @default(10000000)`, `reviewerDeptMap Json?` 추가
- `PlanReview`: `planReportId`로 참조 교체

**백엔드 신규:**
- `plan-report/dto/plan-report.dto.ts` — CreateDto, UpdateDto, SubmitResultDto 등
- `plan-report/vault.ts` — 승인 시 `/Users/juno/ObsidianVault/plans/{year}/{date}-{dept}-{title}.md` 자동 아카이브
- `plan-report/plan-report.repo.ts` — CRUD + submit/approve/reject/submitResult
- `plan-report/plan-report.service.ts` — 조건부 결재 레벨 결정 + 검토자 부서 자동 배정
- `plan-report/plan-report.routes.ts` — multer v2 파일 업로드 포함
- `lib/permissions.ts`: `canApprovePlan()` 추가
- `apiRouter.ts`: `/plan-reports` 등록

**조건부 결재 라우팅:**
```
isNewBusiness=true    → ApproverLevel.ADMIN
budget > limit        → ApproverLevel.GM
otherwise             → ApproverLevel.HEAD
```

**검토자 부서 자동 배정:**
```
hasNewStaff      → HR 부서
hasContract      → 구매 + 법무 부서
hasExternalLease → 시설 + 법무 부서
hasPersonalInfo  → 법무 + 개인정보보호 부서
```

**프론트엔드 신규:**
- `football/src/types/plan-report.ts` — 타입 정의 + `EXTRA_FIELDS_CONFIG` (7개 템플릿)
- `football/src/services/plan-report.service.ts`
- `football/src/pages/finance/PlanReportListPage.tsx` — 필터 + 페이지네이션 목록
- `football/src/pages/finance/PlanReportFormPage.tsx` — 템플릿 선택, 조건 체크박스, 첨부파일
- `football/src/pages/finance/PlanReportDetailPage.tsx` — 검토 현황, 승인/반려, 결과 제출

**삭제:**
- `department-plan/` 백엔드 디렉터리 전체
- `DepartmentPlanListPage`, `DepartmentPlanFormPage`, `DepartmentPlanDetailPage`, `DepartmentBudgetSummaryPage`
- `department-plan.service.ts`, `department-plan.ts` 타입

**테스트:**
- `vault.test.ts` 6개 통과
- `plan-report.service.test.ts` 19개 통과

---

## 7개 PlanReport 템플릿

| 코드 | 이름 | 추가 필드 |
|------|------|----------|
| GENERAL | 일반 계획 | 없음 |
| HR | 인사 계획 | 채용 인원, 직급, 채용 사유 |
| MARKETING | 마케팅 계획 | 캠페인명, 채널, 예상 도달 수 |
| GOODS | 물품 계획 | 품목명, 수량, 공급업체 |
| SQUAD | 스쿼드 계획 | 대상 포지션, 이적 방향, 대상 선수 |
| MEDICAL | 의료 계획 | 의료 항목, 병원명, 처방 기간 |
| IT | IT 계획 | 시스템명, 벤더, SLA 목표 |

---

## 현황 요약

| 영역 | 상태 |
|------|------|
| 스폰서십 ROI 엔드포인트 | ✅ 완료 |
| 스폰서십 만료 크론 알림 | ✅ 완료 |
| Budget 자동 생성 FE | ✅ 완료 |
| OperatingExpense 시즌 필터 | ✅ 완료 |
| auth.repo.ts 필드 오류 수정 | ✅ 완료 |
| PlanReport 시스템 BE + FE | ✅ 완료 |
| DepartmentAnnualPlan 제거 | ✅ 완료 |
| Obsidian Vault 아카이브 | ✅ 완료 |
| DB 마이그레이션 | ✅ 완료 |

---

## 다음 우선순위 제안

1. **채용 자동화** (메모리 기록: 스폰서십+급여 다음 단계)
2. **PlanReport 훈련 출결 페널티** — 무단 지각 3회=결석 1회 규칙 연동
3. **PII 마스킹** — 전화번호 등 프론트 마스킹 미처리
4. **DB 외부 백업 설정** — pgdata volume만 있음
5. **Migration squash** — 39개 → baseline 1개 (나중에)

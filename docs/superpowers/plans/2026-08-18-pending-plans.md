# 미구현 플랜 현황 정리

> 작성일: 2026-08-18  
> 기준: `- [ ]` 미체크 항목 보유 플랜 + 체크박스 없는 플랜  
> 소스: 8/10 세션 요약(PR #242–245) · 8/17 보안/시설 요약(PR #286) · 전체 plans/ 디렉터리 스캔  

---

## 주의: 구현 완료됐으나 체크 미반영 플랜

아래 플랜들은 실제 구현·머지됐지만 체크박스가 `- [ ]`로 남아 있음.

| 플랜 파일 | 머지된 PR | 비고 |
|-----------|----------|------|
| `2026-08-10-plan-report-system.md` | PR #245 | PlanReport 시스템 전체 구현 완료 |
| `2026-08-10-budget-auto-generate.md` | PR #242 | 자동 생성 FE 버튼 포함 완료 |
| `2026-08-18-ledger-integrity.md` | PR #289 (머지됨) | 원장 무결성 4개 태스크 완료 |
| `2026-08-03-facility-management.md` | PR #286 (일부) | PreventiveSchedule·AccessLog·Disposal 구현됨 |

---

## Tier 1 — 완전 미구현 (0 완료, 대량 미체크)

### 보안 / 인가 / 데이터 무결성

| 파일 | 미체크 | 완료 | 설명 |
|------|--------|------|------|
| `2026-08-18-hr-criticals.md` | 63 | 0 | HR·급여 16개 critical (오늘 작성) |
| `2026-08-18-idor-fixes.md` | 28 | 0 | IDOR 인가 누락 4도메인 |
| `2026-08-18-security-hardening.md` | 17 | 0 | P0 보안 헤더·JWT·Rate Limit·OTP |
| `2026-08-18-acwr-training-load.md` | 18 | 0 | ACWR 더블카운팅·취소세션 버그 |
| `2026-08-11-gdpr-pii-encryption-schema.md` | 38 | 0 | GDPR 필드 암호화 스키마 |
| `2026-08-06-demo-account-pii-masking.md` | 28 | 0 | Demo 계정 PII 마스킹 |
| `2026-08-06-permission-helpers-unification.md` | 36 | 0 | 권한 헬퍼 통합 |

### 스폰서십 / 재무

| 파일 | 미체크 | 완료 | 설명 |
|------|--------|------|------|
| `2026-08-17-sponsorship-issues.md` | 65 | 0 | 8/17 페르소나 스폰서십 15개 critical |
| `2026-08-15-sponsorship-form-redesign.md` | 36 | 0 | 국내/해외 스폰서 폼 재설계 |
| `2026-08-03-sponsorship.md` | 27 | 0 | 스폰서십 관리 기본 모듈 |
| `2026-08-10-meal-to-operating-sponsor-bank.md` | 51 | 0 | 식대→운영비, 스폰서 은행계좌 |

### 채용 / HR

| 파일 | 미체크 | 완료 | 설명 |
|------|--------|------|------|
| `2026-08-03-recruitment-automation.md` | 46 | 0 | 채용 자동화 (IBI·우선순위 큐·cron) |
| `2026-08-13-hiring-survey-be.md` | 45 | 0 | 채용 수요조사 연간계획 BE |
| `2026-08-13-hiring-survey-fe.md` | 22 | 0 | 채용 수요조사 연간계획 FE |
| `2026-08-12-recruitment-persona.md` | 22 | 0 | 채용 페르소나 이슈 |
| `2026-08-03-payroll.md` | 38 | 0 | 급여 관리 모듈 |
| `2026-07-31-hr-report.md` | 21 | 0 | HR 보고서 통합 |

### 유소년

| 파일 | 미체크 | 완료 | 설명 |
|------|--------|------|------|
| `2026-07-22-youth-module-1-foundation.md` | 49 | 0 | 유소년 기반 인프라 |
| `2026-07-22-youth-module-8-academy-fees.md` | 49 | 0 | 아카데미 회비 관리 |
| `2026-07-23-callup-docs-workflow.md` | 46 | 0 | 유소년 콜업 서류 확인 |
| `2026-07-22-youth-module-6-growth-report.md` | 41 | 0 | 성장 리포트 시스템 |
| `2026-07-22-youth-module-7-safeguarding.md` | 33 | 0 | 유소년 보호 프로토콜 |
| `2026-07-22-youth-module-5-development-dashboard.md` | 33 | 0 | 육성 모니터링 대시보드 |
| `2026-07-22-youth-module-3-incident-report.md` | 30 | 0 | 사고 보고서 |
| `2026-07-22-youth-module-2-lineup-position.md` | 27 | 0 | 라인업 포지션·PDI |
| `2026-07-22-youth-module-4-guardian-notifications.md` | 20 | 0 | Guardian 알림 |
| `2026-07-22-youth-module-9-lite-mode.md` | 25 | 0 | 소규모 구단 Lite Mode |
| `2026-08-14-academy-fee-payment-flow.md` | 46 | 0 | 아카데미 비용 결제 플로우 |
| `2026-08-05-guardian-feature.md` | 29 | 0 | Guardian 학부모 Feature |

### 인프라 / 클럽 구조

| 파일 | 미체크 | 완료 | 설명 |
|------|--------|------|------|
| `2026-08-04-club-gm-hierarchy.md` | 51 | 0 | Club Entity·GM 역할 계층 |
| `2026-08-03-super-admin.md` | 49 | 0 | 수퍼어드민 전사 계정 |
| `2026-08-01-department-hierarchy.md` | 29 | 0 | 부서 계층 구조 |
| `2026-07-31-department-crud.md` | 30 | 0 | Department CRUD |
| `2026-08-03-webhook-applications.md` | 37 | 0 | 인바운드 지원서 웹훅 |
| `2026-07-25-i18n.md` | 77 | 0 | 국문/영문 i18n |
| `2026-07-17-coach-team-schema.md` | 42 | 0 | Coach·Team 스키마 확장 |
| `2026-07-17-coaching-staff-schema.md` | 33 | 0 | 코칭스태프 스키마 |

### 경기 / 전술 / 훈련

| 파일 | 미체크 | 완료 | 설명 |
|------|--------|------|------|
| `2026-07-21-match-lineup.md` | 30 | 0 | 경기 선발 라인업 |
| `2026-08-07-squad-plan-save.md` | 33 | 0 | 스쿼드 플래너 저장 |
| `2026-08-07-tactical-player-readonly.md` | 8 | 0 | 전술 분석 선수 읽기 전용 |
| `2026-08-07-transfer-request.md` | 26 | 0 | 이적 요청 구현 |
| `2026-08-03-callup-type-contract-guard.md` | 24 | 0 | 콜업 타입·계약 가드 |
| `2026-07-25-feature12-secondary-position-staff-eval.md` | 24 | 0 | 멀티포지션·코칭평가 |
| `2026-07-25-feature13-ocr-ai-video.md` | 40 | 0 | OCR 경기기록지·AI 영상요약 |

### 의료 / 시설

| 파일 | 미체크 | 완료 | 설명 |
|------|--------|------|------|
| `2026-08-12-megan-medical-workflow.md` | 49 | 0 | 8/17 페르소나 의료 워크플로우 |
| `2026-08-12-facility-persona.md` | 31 | 0 | 시설·장비 페르소나 이슈 |
| `2026-08-12-fan-ticket-persona.md` | 29 | 0 | 팬·티켓 페르소나 이슈 |
| `2026-08-14-persona-remaining-items.md` | 44 | 0 | 페르소나 잔여 항목 |
| `2026-08-16-certification-management.md` | 42 | 0 | 인증 관리 시스템 |
| `2026-08-16-kane-bhs-conditioning-injury.md` | 0 | — | *(별도 확인 필요)* |
| `2026-08-03-facility-management-frontend.md` | 17 | 0 | 시설 관리 FE |
| `2026-07-25-report-approval-headcoach.md` | 6 | 0 | 보고서 결재 HEAD_COACH |
| `2026-07-07-column-simplification.md` | 5 | 0 | 테이블 컬럼 단순화 |
| `2026-08-07-kpi-dashboard-auto-report.md` | 31 | 0 | KPI 대시보드·자동 보고서 |
| `2026-08-07-ticket-sales.md` | 33 | 0 | 홈경기 티켓 판매 관리 |
| `2026-08-05-asset-mgmt-feature.md` | 90 | 0 | 자산관리 부서 (Feature 16) |
| `2026-08-07-coach-view.md` | 30 | 7 | 감독 뷰 (7개 완료) |
| `2026-08-03-report-multi-stage-approval.md` | 48 | 0 | 보고서 다단계 결재 |

---

## Tier 2 — 부분 구현 (일부 완료, 다수 미완)

| 파일 | 미체크 | 완료 | 설명 |
|------|--------|------|------|
| `2026-07-30-gm-data-foundation.md` | 50 | 6 | GM 데이터 기반 |
| `2026-07-30-financial-report-kpi.md` | 41 | 5 | 재무 보고서·임금캡 KPI |
| `2026-07-31-knapsack-operating-budget.md` | 38 | 8 | Knapsack 운영비 예산 |
| `2026-07-25-coaching-staff-management.md` | 29 | 0 | 코칭스태프 통합 관리 |
| `2026-07-20-shot-event-xa-calculation.md` | 25 | 7 | Shot Event·xA 계산 |
| `2026-07-30-wage-cap-simulation.md` | 15 | 5 | 임금 상한 시뮬레이션 |

---

## Tier 3 — 거의 완료 (1개 미체크)

이 플랜들은 체크박스 1개만 미체크. 마무리 또는 checkbox 갱신 필요.

| 파일 | 미체크 | 완료 |
|------|--------|------|
| `2026-07-20-player-dashboard.md` | 1 | 64 |
| `2026-08-12-lee-kane-tactical-training.md` | 1 | 60 |
| `2026-07-14-partner-equipment-loan.md` | 1 | 55 |
| `2026-07-17-coach-hiring-ui.md` | 1 | 50 |
| `2026-07-20-notification-jersey-squad.md` | 1 | 43 |
| `2026-07-17-injury-assessment-external-report.md` | 1 | 39 |
| `2026-07-18-training-load-coach-availability.md` | 1 | 37 |
| `2026-07-14-report-approval.md` | 1 | 37 |
| `2026-07-18-training-reference.md` | 1 | 36 |
| `2026-07-17-external-report-automation.md` | 1 | 34 |
| `2026-07-18-training-results-report.md` | 1 | 32 |
| `2026-07-15-injury-report.md` | 1 | 32 |
| `2026-07-19-coach-role-optimization.md` | 1 | 29 |
| `2026-07-18-training-video-assignment.md` | 1 | 29 |
| `2026-07-18-squad-planner.md` | 1 | 29 |
| `2026-07-14-medical-expense.md` | 1 | 29 |
| `2026-07-18-notification-completions.md` | 1 | 28 |
| `2026-07-18-player-development-plan.md` | 1 | 24 |
| `2026-07-18-audit-log-contract-detail.md` | 1 | 24 |
| `2026-07-14-dashboard-by-role.md` | 1 | 24 |
| `2026-07-18-tactical-phase-forms.md` | 1 | 23 |
| `2026-07-18-player-callup.md` | 1 | 22 |
| `2026-07-12-issues-10-7-roles-permissions.md` | 1 | 21 |
| `2026-07-18-team-season-admin-ui.md` | 1 | 20 |
| `2026-07-17-attendance-penalty.md` | 1 | 19 |
| `2026-07-15-medical-duty-report.md` | 1 | 19 |
| `2026-07-17-medical-dashboard-kpi.md` | 1 | 14 |
| `2026-07-19-coaching-role-session-prefill.md` | 1 | 13 |
| `2026-07-17-match-detail-fotmob.md` | 1 | 10 |

---

## 체크박스 없는 플랜 (미추적)

| 파일 | 설명 |
|------|------|
| `2026-08-08-finance-integrity.md` | 재무 무결성 — 구현 완료 추정, 체크 미반영 가능성 |
| `2026-08-08-tomorrow-tasks.md` | 2026-08-08 할일 목록 — 내용 검토 필요 |

---

## 8/10 세션 요약에서 확인된 구현 완료 내역 (참고)

> 소스: `specs/2026-08-11-session-summary.md` (삭제됨)  
> PR #242–245, 작업기간 2026-08-10 ~ 2026-08-11

- ✅ 스폰서십 ROI 엔드포인트 (`GET /sponsorships/roi`, `/expiring`)
- ✅ 스폰서십 만료 30일 크론 알림
- ✅ Budget 자동 생성 FE 버튼
- ✅ OperatingExpense 시즌 필터 (`?seasonId`)
- ✅ auth.repo.ts 잘못된 필드 참조 수정
- ✅ PlanReport 시스템 BE + FE 전체 (PR #245)
- ✅ DepartmentAnnualPlan 제거
- ✅ Obsidian Vault 아카이브 자동화

**다음 우선순위 제안 (당시):** 채용 자동화 · PlanReport 훈련출결 페널티 · PII 마스킹 · DB 백업 · Migration squash

---

## 8/17 보안·시설 요약에서 확인된 구현 완료 내역 (참고)

> 소스: `plans/2026-08-17-security-facility-summary.md` (삭제됨)  
> PR #286, 브랜치 `feat/security-facility-issues`

- ✅ `PreventiveSchedule` 모델 + CRUD API + 일일 크론
- ✅ `PartnerContract` SLA 필드 (responseHours, resolutionDays, penaltyPerDay)
- ✅ `FacilityAccessLog` 모델 + 접근 제어 규칙 + API
- ✅ `EquipmentDisposalVerification` 2단계 승인 (FM 확인 → GM 승인)
- ✅ 신규 테스트 14개 (disposal 9 + preventive-schedule 5)

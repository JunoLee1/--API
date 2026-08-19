# 미그릴·미구현 현황 요약

> 작성일: 2026-08-18  
> 소스: `2026-08-18-pending-plans.md`

---

## 현재 구현 중 (실행 중 또는 플랜 완성)

| 플랜 | 미체크 | 상태 |
|------|--------|------|
| `2026-08-18-hr-criticals.md` | 63 | ▶ 실행 중 (T1 커밋 완료) |
| `2026-08-18-idor-fixes.md` | 28 | 플랜 완성, 미실행 |
| `2026-08-18-security-hardening.md` | 17 | 플랜 완성, 미실행 |
| `2026-08-18-acwr-training-load.md` | 18 | 플랜 완성, 미실행 |
| `2026-08-17-sponsorship-issues.md` | 65 | 플랜 완성, 미실행 |

---

## 그릴됐지만 미구현 (8/12·8/17 그릴 → 플랜 있음 → 구현 안됨)

| 도메인 | 플랜 파일 | 미체크 |
|--------|-----------|--------|
| 의료 워크플로우 | `2026-08-12-megan-medical-workflow.md` | 49 |
| 페르소나 잔여 | `2026-08-14-persona-remaining-items.md` | 44 |
| 인증관리 | `2026-08-16-certification-management.md` | 42 |
| 시설 페르소나 | `2026-08-12-facility-persona.md` | 31 |
| 팬·티켓 페르소나 | `2026-08-12-fan-ticket-persona.md` | 29 |
| 채용 페르소나 | `2026-08-12-recruitment-persona.md` | 22 |
| 시설 보안 이슈 | `2026-08-16-security-facility-issues.md` | — |

---

## 그릴 미실행 도메인 (페르소나 분석 자체가 없음)

### 유소년 (Youth) — 가장 큰 미구현 영역
| 플랜 | 미체크 |
|------|--------|
| `2026-07-22-youth-module-1-foundation.md` | 49 |
| `2026-08-14-academy-fee-payment-flow.md` | 46 |
| `2026-07-23-callup-docs-workflow.md` | 46 |
| `2026-07-22-youth-module-8-academy-fees.md` | 49 |
| `2026-07-22-youth-module-6-growth-report.md` | 41 |
| `2026-07-22-youth-module-7-safeguarding.md` | 33 |
| `2026-07-22-youth-module-5-development-dashboard.md` | 33 |
| `2026-07-22-youth-module-3-incident-report.md` | 30 |
| `2026-07-22-youth-module-2-lineup-position.md` | 27 |
| `2026-07-22-youth-module-4-guardian-notifications.md` | 20 |
| `2026-07-22-youth-module-9-lite-mode.md` | 25 |
| `2026-08-05-guardian-feature.md` | 29 |
| **소계** | **~428** |

### 인프라 / 클럽 구조
| 플랜 | 미체크 |
|------|--------|
| `2026-07-25-i18n.md` | 77 |
| `2026-08-04-club-gm-hierarchy.md` | 51 |
| `2026-08-03-super-admin.md` | 49 |
| `2026-08-10-meal-to-operating-sponsor-bank.md` | 51 |
| `2026-07-17-coach-team-schema.md` | 42 |
| `2026-08-03-webhook-applications.md` | 37 |
| `2026-07-17-coaching-staff-schema.md` | 33 |
| `2026-07-31-department-crud.md` | 30 |
| `2026-08-01-department-hierarchy.md` | 29 |

### 재무 (그릴 미실행)
| 플랜 | 미체크 |
|------|--------|
| `2026-07-30-gm-data-foundation.md` | 50 |
| `2026-07-30-financial-report-kpi.md` | 41 |
| `2026-07-31-knapsack-operating-budget.md` | 38 |
| `2026-08-03-payroll.md` | 38 |
| `2026-07-31-hr-report.md` | 21 |
| `2026-08-03-sponsorship.md` | 27 |
| `2026-07-30-wage-cap-simulation.md` | 15 |

### 경기 / 전술 / 훈련
| 플랜 | 미체크 |
|------|--------|
| `2026-07-25-feature13-ocr-ai-video.md` | 40 |
| `2026-08-07-squad-plan-save.md` | 33 |
| `2026-08-07-ticket-sales.md` | 33 |
| `2026-08-07-report-multi-stage-approval.md` | 48 |
| `2026-07-21-match-lineup.md` | 30 |
| `2026-08-07-coach-view.md` | 30 (7 완료) |
| `2026-08-08-transfer-request.md` | 26 |
| `2026-07-25-feature12-secondary-position-staff-eval.md` | 24 |
| `2026-08-03-callup-type-contract-guard.md` | 24 |
| `2026-08-07-kpi-dashboard-auto-report.md` | 31 |

### 보안 (그릴 미실행, 플랜 있음)
| 플랜 | 미체크 |
|------|--------|
| `2026-08-11-gdpr-pii-encryption-schema.md` | 38 |
| `2026-08-06-permission-helpers-unification.md` | 36 |
| `2026-08-06-demo-account-pii-masking.md` | 28 |

### 자산관리
| 플랜 | 미체크 |
|------|--------|
| `2026-08-05-asset-mgmt-feature.md` | 90 |

---

## 다음 그릴 세션 후보

| 우선순위 | 도메인 | 이유 |
|---------|--------|------|
| 🔴 1순위 | **유소년 (Youth)** | 428개 미체크, 그릴 전혀 없음, 가장 큰 공백 |
| 🔴 2순위 | **인프라 (i18n·super-admin·club-gm)** | 핵심 아키텍처 미구현, 다른 모듈 블로킹 |
| 🟡 3순위 | **재무 (payroll·HR-report·financial-KPI)** | 이미 일부 구현됐지만 그릴 없이 진행됨 |
| 🟡 4순위 | **경기·전술** | OCR·AI 영상, 멀티포지션 등 고부가가치 |
| 🟢 5순위 | **자산관리** | 90개 미체크, 독립 도메인 |

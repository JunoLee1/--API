# Football ERP — Persona Catalog (Hybrid)

> **Source**: `prisma/schema.prisma` (Role/CoachingRole/FrontOfficeRole/Department enum + relations) + `prisma/seed.ts` (실제 로그인 가능 credential).

## 카탈로그

**공통 password**: `Password1!` (bcrypt hash, seed 유저 모두 동일)

| # | Persona | Email | Role 조합 | 대표 도메인 | 대표 API workflow |
|---|---------|-------|-----------|--------------|-------------------|
| 1 | **ADMIN** | admin@club.com | ADMIN | 전사 관리 | user CRUD, admin |
| 2 | **SUPER_ADMIN** | superadmin@platform.com | SUPER_ADMIN | 플랫폼 관리 | admin, user create |
| 3 | **GM** | gm@club.com | GM | 최종 결재 | plan-report/approve, report/approve, hiring-dispatch |
| 4 | **HEAD_COACH** | coach@club.com | COACHING_STAFF + HEAD_COACH | 훈련·전술 | training, lineup, tactical |
| 5 | **ASSISTANT_COACH** | assistant@club.com | COACHING_STAFF + ASSISTANT_COACH | 훈련 보조 | training, players |
| 6 | **DEF_COACH** | defensive@club.com | COACHING_STAFF + DEFENSIVE_COACH | 수비 전술 | tactical, training |
| 7 | **ATK_COACH** | attacking@club.com | COACHING_STAFF + ATTACKING_COACH | 공격 전술 | tactical, training |
| 8 | **PHYS_COACH** | physical@club.com | COACHING_STAFF + PHYSICAL_COACH | 체력 · 부상 | training, injuries |
| 9 | **GK_COACH** | gk@club.com | COACHING_STAFF + GOALKEEPER_COACH | 골키퍼 | training, players |
| 10 | **MEDICAL** | medical@club.com | COACHING_STAFF + MEDICAL | 의료 | injuries, medical-expenses |
| 11 | **MEDICAL_DIRECTOR** | meddir@club.com | COACHING_STAFF + MEDICAL_DIRECTOR | 의료 총괄 | injuries, medical-equipment-loan, reports |
| 12 | **TD** | td@club.com | FRONT_OFFICE + TD | 기술 이사 | squad-plan, callup |
| 13 | **HR_MANAGER** | hr@club.com | FRONT_OFFICE + HR_MANAGER | 채용/HR | hiring-survey, plan-report, recruitment |
| 14 | **HR_STAFF** | hr.staff@club.com | FRONT_OFFICE + HR_STAFF | 채용 실무 | hiring-survey/respond, interviews |
| 15 | **ASSET_MANAGER** | asset@club.com | FRONT_OFFICE + ASSET_MANAGER | 자산 총괄 | equipment, asset-request, maintenance |
| 16 | **ASSET_STAFF** | asset.staff@club.com | FRONT_OFFICE + ASSET_STAFF | 자산 실무 | equipment-loan, asset-request |
| 17 | **FINANCE_MANAGER** | finance@club.com | FRONT_OFFICE + FINANCE_MANAGER | 재무 총괄 | ledger, budget-control, payroll |
| 18 | **FINANCE_STAFF** | finance.staff@club.com | FRONT_OFFICE + FINANCE_STAFF | 재무 실무 | operating-expense, ledger |
| 19 | **FACILITY_MANAGER** | facility.manager@club.com | FRONT_OFFICE + FACILITY_MANAGER | 시설 총괄 | facility, maintenance-request |
| 20 | **FACILITY_STAFF** | facility.staff@club.com | FRONT_OFFICE + FACILITY_STAFF | 시설 실무 | facility, maintenance-request |
| 21 | **PLAYER** | player@club.com | PLAYER | 선수 자기 서비스 | players/me, training, notifications |

## Selected for Load Test (7 대표)

부하 시뮬 대상 (도메인 커버리지 + 리스크 큰 endpoint 우선):

1. **HR_MANAGER** (hiring workflow)
2. **HEAD_COACH** (training·tactical)
3. **FINANCE_MANAGER** (budget·ledger)
4. **ASSET_MANAGER** (equipment)
5. **GM** (approval queues — read-heavy)
6. **PLAYER** (self-service)
7. **MEDICAL_DIRECTOR** (medical workflow)

각 페르소나는 3개 read endpoint 로 workflow 시뮬 → 총 21 endpoint calls per VU cycle.

## 각 페르소나의 대표 workflow

`loadtest/personas.k6.js` 에서 실제 실행되는 워크로드:

```js
HR_MANAGER:      GET /hiring-surveys, /plan-reports, /recruitment/job-postings
HEAD_COACH:      GET /training/sessions, /players, /tactical/lineups
FINANCE_MANAGER: GET /operating-expense, /budget-plan, /financial-report
ASSET_MANAGER:   GET /equipment/items, /asset-request, /equipment-loan
GM:              GET /plan-reports?filter=pending-final, /report?filter=pending-final, /hiring-dispatch?filter=pending-dispatch
PLAYER:          GET /players/me, /training/sessions, /notifications
MEDICAL_DIRECTOR: GET /injuries, /medical-equipment-loan, /medical-expenses
```

## Auth 방식

- **Login**: `POST /api/auth/login` `{email, password}` → `Set-Cookie: access-token=<jwt>`
- **Rate limit**: 10회 / 5분 (login only)
- **Token 재사용**: k6 `setup()` 에서 각 persona 1회 login → per-VU workflow 에서 재사용 (cookie header 수동 set)
- **JWT expiry**: 1시간 (access token) → 부하 테스트 30초-5분 범위에서 충분

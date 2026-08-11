# 축구 ERP 통합 QA 체크리스트

> 최종 수정: 2026-08-06

---

## 테스트 계정

| 역할 | 이메일 | 비밀번호 | 비고 |
|------|--------|----------|------|
| SUPER_ADMIN | superadmin@platform.com | Password1! | 전 구단 접근, x-team-id 헤더로 팀 전환 |
| ADMIN | admin@club.com | Password1! | |
| GM | gm@club.com | Password1! | |
| FRONT_OFFICE / HR_MANAGER | hr@club.com | Password1! | clubId=3 |
| FRONT_OFFICE / HR_STAFF | hr.staff@club.com | Password1! | clubId=3 |
| FRONT_OFFICE / ASSET_MANAGER | asset.manager@club.com | Password1! | clubId=3 |
| FRONT_OFFICE / ASSET_STAFF | asset.staff@club.com | Password1! | clubId=3 |
| FRONT_OFFICE / FINANCE_MANAGER | finance.manager@club.com | Password1! | clubId=3 |
| FRONT_OFFICE / FINANCE_STAFF | finance.staff@club.com | Password1! | clubId=3 |
| FRONT_OFFICE / FACILITY_MANAGER | facility.manager@club.com | Password1! | clubId=3 |
| FRONT_OFFICE / FACILITY_STAFF | facility.staff@club.com | Password1! | clubId=3 |

---

## 공통 사전 조건

- [ ] 웹 서버(`http://129.225.166.247`) 에서 테스트
- [ ] 브라우저 콘솔 및 네트워크 탭 열어두기
- [ ] 각 섹션 전 로그아웃 후 해당 역할 계정으로 재로그인

---

## 1. HR 보고서 섹션

### UI/UX 및 기타

- [ ] 데이터 부재 시 빈 상태(Empty State) 전용 일러스트/아이콘이 디자인 가이드에 맞게 노출되는가?

---

## 2. 통합 보고서 섹션

### 권한 및 보안

- [ ] 비인증 유저(`Authorization` 쿠키 없음) 접근 시 `401 Unauthorized` 에러를 반환하는가?
  - `GET /api/reports/*` — 쿠키 삭제 후 접근

### UI/UX 및 기타

- [ ] 필터링 렌더링이 지연 없이 정상적으로 작동하는가?

---

## 3. 통합 보고서 생성

### UI/UX 및 기타

- [ ] 타입 셀렉션 시 내부 상수(enum 값)가 아닌 사용자 친화적인 명칭으로 렌더링되는가?
  - 예: `MEDICAL_EXPENSE` → "의료비", `ASSET` → "자산"

---

## 4. 유저 관리 (유소년 / 직원 / 선수)

### 권한 및 보안

- [ ] 비인증 유저 접근 시 `401` 에러를 반환하는가?
  - `GET /api/admin/users`, `GET /api/players`, `GET /api/guardian` — 비인증 접근
- [ ] 이름, 이메일 등 민감한 개인정보가 마스킹 처리되어 보호되는가?
  - FRONT_OFFICE / PLAYER 계정으로 `/api/admin/users` 접근 시 확인

### 기능 및 비즈니스 로직

- [ ] 이메일 또는 전화번호 중복 등록 시 `409 Conflict` 에러를 던지는가?
  - `POST /api/admin/users` — 기존 이메일로 재등록 시도
- [ ] 전화번호 형식 오류 시 `400 Bad Request` 에러를 반환하는가?
- [ ] 존재하지 않는 유저 조회 시 `404 Not Found` 에러를 반환하는가?
  - `GET /api/admin/users/999999`

### UI/UX 및 기타

- [ ] Select 폼 선택 시 ID/UUID 값이 아닌 실제 이름/명칭이 노출되는가?

---

## 5. 운영 재무 및 파트너 관리

### 기능 및 비즈니스 로직

- [ ] 이름 중복 시 `409` 에러, 전화번호 형식 불일치 시 `400` 에러를 던지는가?
- [ ] 페이지네이션(Pagination)이 정상 작동하여 목록 이동이 가능한가?
- [ ] 티켓 및 유니폼 매출 조회 기능과 해외 거래 시 환율 자동 환산 로직이 정확한가?
  - `POST /api/ledger` — currency: "USD", exchangeRate 자동 계산 확인
- [ ] 예산 초과 지출 시 경고 메시지 노출 및 결제 차단(방어 UI) 기능이 작동하는가?

---

## 6. 시설 관리 및 지출 결의

### 기능 및 비즈니스 로직

- [ ] 타 부서(운영/스포츠) 수리 요청이 연동되며 소모품 재고 부족 시 경고 알림이 발생하는가?
- [ ] 고가 수리 건에 대해 재무팀으로 자동 상신되는 지출 결의 워크플로우가 작동하는가?
  - `MaintenanceRequest.estimatedCost` 일정 금액 초과 시 재무 제출 플로우 확인

### 권한 및 보안

- [ ] ADMIN 계정이 시설 관리 포함 모든 메뉴를 정상적으로 조회할 수 있는가?

---

## 7. 권한 매트릭스 (RBAC 종합)

| 기능 | SUPER_ADMIN | ADMIN | GM | FRONT_OFFICE |
|------|-------------|-------|----|-------------|
| 구단 생성/수정 | ✅ | ❌ | ❌ | ❌ |
| 유저 생성/수정 | ✅ | ✅ | ❌ | ❌ |
| 팀 생성/수정 | ✅ | ✅ | ✅ | ❌ |
| 선수 계약 조회 | ✅ | ✅ | ✅ | HR_MANAGER/HR_STAFF |
| 재무 보고서 조회 | ✅ | ✅ | ✅ | FINANCE_MANAGER/FINANCE_STAFF |
| 재무 보고서 작성 | ✅ | ✅ | ✅ | FINANCE_MANAGER |
| HR 보고서 조회 | ✅ | ✅ | ✅ | HR_MANAGER/HR_STAFF |
| HR 보고서 작성 | ✅ | ✅ | ✅ | HR_MANAGER |
| 영입/이적 관리 | ✅ | ✅ | ✅ | TD |
| 급여 관리 | ✅ | ✅ | ✅ | HR_MANAGER |
| 시설 점검/수리 | ✅ | ✅ | ❌ | FACILITY_MANAGER/FACILITY_STAFF |

### 권한별 403 검증

- [ ] **ADMIN** 계정으로 `/api/clubs` POST 시도 → `403 Forbidden`
- [ ] **GM** 계정으로 `/api/admin/users` POST 시도 → `403 Forbidden`
- [ ] **FRONT_OFFICE(FINANCE_STAFF)** 계정으로 재무 보고서 작성(WRITE) 시도 → `403 Forbidden`
- [ ] **FRONT_OFFICE(HR_STAFF)** 계정으로 HR 데이터 수정 시도 → `403 Forbidden`
- [ ] **PLAYER** 계정으로 전술 편집 시도 → `403 Forbidden`
- [ ] **GUARDIAN** 계정으로 다른 자녀 정보 접근 시도 → `403 Forbidden`

---

## 8. 부서 및 자산 관리

### 권한 및 보안

- [ ] 일반 유저(COACHING_STAFF, PLAYER)가 부서 생성/수정/삭제 시도 시 `403 Forbidden` 에러를 반환하는가?
  - `POST /api/departments` — COACHING_STAFF 계정으로 시도

### 기능 및 비즈니스 로직

- [ ] 부서명 중복 시 `409`, 빈 값 또는 형식 오류 시 `400` 에러를 던지는가?
  - `POST /api/departments` — `name: ""` 또는 기존 부서명으로 시도
- [ ] 자산 감가상각 자동 계산 및 IT 기기 중복 할당 방지 로직이 유효한가?

### UI/UX 및 기타

- [ ] 부서명 클릭 시에만 하위 팀 목록이 토글(펼치기/접기)되는가?

---

## 9. 스태프 및 인사(HR) 관리

### 권한 및 보안

- [ ] 개인정보 노출 방지를 위한 마스킹 처리가 적용되었는가?

### 기능 및 비즈니스 로직

- [ ] 급여 음수 계산 방지 로직이 작동하는가?
  - `POST /api/payroll` — `baseSalary: -1` 시도
- [ ] 퇴사 처리(`terminatedAt` 설정) 시 해당 유저의 시스템 접근 권한이 즉시 회수(401/403)되는가?
  - `PUT /api/staff-records/:id/terminate` 후 동일 계정으로 로그인 시도

---

## 10. 권한 변경 및 UI 개선

### 권한 및 보안

- [ ] 관리자 또는 본인이 아닌 타인이 본인 정보 수정 시도 시 `403` 에러를 던지는가?

---

## 11. 조직 내 팀 관리

### 권한 및 보안

- [ ] ADMIN/부서장 승인 없이 팀 CRUD 시도 시 `403` 에러를 반환하는가?

### 기능 및 비즈니스 로직

- [ ] 팀명 중복 시 `409`, 형식 오류 시 `400`, 존재하지 않는 팀 조회 시 `404` 처리가 정확한가?
  - `POST /api/teams` — 기존 팀명, 동일 clubId 조합으로 시도

### UI/UX 및 기타

- [ ] 팀별로 특화된 올바른 대시보드가 렌더링되는가?
  - FIRST_TEAM / B_TEAM / YOUTH 각각 확인

---

## 12. 구단 최종 승인 (GM)

### 권한 및 보안

- [ ] GM 이외 권한 없는 유저가 최종 승인 시도 시 `403` 에러를 반환하는가?

### 기능 및 비즈니스 로직

- [ ] 유소년팀 생성 및 수정에 대한 전권이 정상 작동하는가?
  - GM 계정으로 `POST /api/teams` — `type: "YOUTH"` 팀 생성

---

## 13. 전사 관리자 (SuperAdmin)

### 기능 및 비즈니스 로직

- [ ] 구단 등록 시 중복(`409`), 국가/리그 부재(`404`), 형식 오류(`400`) 처리가 완벽한가?
  - `POST /api/clubs` — name 중복 시도, 존재하지 않는 countryId 시도
- [ ] 국가별 사업자 식별 번호(사업자등록번호, VAT Number 등) 필수값 및 유효성 검증이 수행되는가?

### UI/UX 및 기타

- [ ] [리그/대회 → 구단 → 운영팀]으로 이어지는 진입 프로세스가 직관적인가?

### SUPER_ADMIN 전용 기능

- [ ] `x-team-id` 헤더로 특정 팀 컨텍스트 전환이 정상 작동하는가?
  - 로그인 후 `x-team-id: {teamId}` 헤더를 포함해 팀 전용 데이터 조회
- [ ] 다른 구단의 데이터를 조회할 수 있는가? (SUPER_ADMIN은 전 구단 접근 가능)

---

## 14. 유소년 학부모 서비스

### 권한 및 보안

- [ ] 자녀가 아닌 타인 정보 접근 또는 관리자 메뉴 접근 시 `403` 에러를 던지는가?
- [ ] 소셜 로그인(OAuth) 시 `200 OK`와 함께 정상 로그인되는가?

### 기능 및 비즈니스 로직

- [ ] 자녀 매핑/초대 코드 방식에서 중복 연동(`409`) 및 정보 부재(`404`) 처리가 적절한가?
- [ ] 자녀 부상 및 1군 콜업 시 실시간 알림이 발송되는가?

---

## 15. 자산 및 지원 통합 검증

### 권한 및 보안 (공통)

- [ ] 타 부서 데이터 접근 시 `403` 에러, 비인증 시 `401` 에러를 일관되게 반환하는가?
  - FACILITY_STAFF 계정으로 HR 데이터(`/api/staff-records`) 수정 시도

### 기능 및 비즈니스 로직

- [ ] HR: 급여 음수 계산 방지 로직 및 퇴사자 권한 즉시 회수 기능이 작동하는가?
- [ ] IT/재무: 감가상각 자동 계산, 예산 초과 지출 경고, 데이터 자동 동기화가 정확한가?
- [ ] 승인 완료된 보고서에 대한 수정 불가(Lock) 처리가 수행되는가?
  - `PUT /api/financial-reports/:id` — `status: "APPROVED"` 보고서 수정 시도 → `403` 또는 `400`

---

## 16. 스포츠 부서 통합 운영

### 권한 및 보안

- [ ] 감독/코치/스태프 간 RBAC(역할 기반 접근 제어)가 세분화되어 적용되었는가?
  - COACHING_STAFF(일반 코치)가 전술 편집 시도 → 제한 확인

### 기능 및 비즈니스 로직

- [ ] 의무: RTP(복귀) 지표 기반 승인 버튼 활성화 로직 및 자동 의무보고서 생성이 정상인가?
- [ ] 인수인계: 선수별 통합 DB(훈련/부상/태그업)가 실시간 동기화되며, 태그업 근태 정보가 TD의 영입/징계 시스템 및 HR의 급여 정산 로직과 정확히 연동되는가?

---

## 17. 경기 운영 관리

### 기능 및 비즈니스 로직

- [ ] 실제 계약된 선수 기반 라인업 구성 및 경기 ID 부재 시 `404` 에러 처리가 되는가?
  - `GET /api/matches/999999` → `404`
- [ ] 리그/컵 대회별 유효한 상대 팀 매칭 및 부상 발생 시 자동 알림이 발송되는가?

---

## 18. 선수 가치 및 정보

### 기능 및 비즈니스 로직

- [ ] 스탯/나이/계약기간에 따른 시장 가치(Market Value) 자동 갱신 로직이 정확한가?

---

## 19. 전술 및 기밀 정보 보안

### 권한 및 보안

- [ ] 선수 계정은 '읽기 전용'으로 전환되며, 비스포츠 부서 접근 시 `403` 에러로 기밀을 보호하는가?
  - PLAYER 계정으로 `POST /api/tactical` 시도 → `403`
  - PLAYER 계정으로 `GET /api/tactical` 시도 → `200` (읽기는 허용)

---

## 20. 공통 파일 업로드

### 기능 및 비즈니스 로직

- [ ] 용량 초과 시 `413 Payload Too Large` 에러를 던져 서버를 보호하는가?

---

## 21. 전사 보안 및 로그인 정책

### 권한 및 보안

- [ ] 비밀번호 해싱 저장 — DB에서 직접 `password` 필드 확인 시 bcrypt hash 형태인가?
- [ ] 5회 연속 로그인 실패 시 계정 잠금(`429` 또는 `403`) 기능이 수행되는가?
- [ ] 비밀번호 복잡성 규정 및 최근 사용 비밀번호 재사용 제한(`400`)이 적용되는가?

---

## 22. 기술 이사 (TD) 영입/징계 관리

### 기능 및 비즈니스 로직

- [ ] 영입/징계 연동: 스포츠 부서의 태그업 기록에 따른 징계(출전 정지/벌금)가 경기 라인업 구성 및 HR 급여 시스템에 자동 반영되는가?

---

## 추가: 현재 500 에러 복구 검증

> PR #153 배포 후 확인

- [ ] `GET /api/departments` → `200`
- [ ] `GET /api/meal-expenses` → `200`
- [ ] `GET /api/staff-records` → `200`
- [ ] `GET /api/sponsorships` → `200`
- [ ] hr@club.com 로그인 → 성공
- [ ] hr.staff@club.com 로그인 → 성공
- [ ] asset.staff@club.com 로그인 → 성공
- [ ] finance.staff@club.com 로그인 → 성공
- [ ] facility.manager@club.com 로그인 → 성공
- [ ] facility.staff@club.com 로그인 → 성공

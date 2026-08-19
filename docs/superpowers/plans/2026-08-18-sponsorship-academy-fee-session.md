# Sponsorship & Academy Fee 이슈 수정 세션 요약 (2026-08-18)

## 완료 항목

### 1. 연락처 로그(Contact Log) RBAC
- **파일**: `apps/api/src/partner/partner.routes.ts`
- GET/POST `/:partnerId/contacts` → `ADMIN`-like 또는 `FRONT_OFFICE` 역할만 접근
- 일반 직원/GUARDIAN 접근 차단

### 2. Cron 타임존 KST 적용
- **파일**: `apps/api/src/jobs/contactFollowUpNotifier.ts`, `academyFeeBilling.ts`, `academyFeeDelinquency.ts`
- 기존: UTC 09:00 실행 (= KST 18:00, 업무 시간 외)
- 수정: `{ timezone: "Asia/Seoul" }` 옵션 추가 → KST 09:00 실행

### 3. 아카데미 회비 목록 재무팀 읽기 권한 추가
- **파일**: `apps/api/src/academy-fee/academy-fee.routes.ts`
- GET `/`, `/stats`, `/player/:playerId` → `canReadHR || canReadFinance` 조건으로 확장
- 기존: HR팀만 조회 가능 → 재무팀도 조회 가능

### 4. 채용 지원 중복 방지
- **파일**: `apps/api/prisma/schema.prisma`, `recruitment.repo.ts`, `recruitment.service.ts`
- `JobApplication`에 `@@unique([postingId, email])` 추가
- `apply()` 시 같은 공고에 동일 이메일 재지원 시 `409 APPLICATION_DUPLICATE`

### 5. 스폰서십 조항 이관(copy-from)
- **파일**: `clause.repo.ts`, `clause.service.ts`, `clause.controller.ts`, `sponsorship.routes.ts`
- `POST /:id/clauses/copy-from/:sourceId` 엔드포인트 추가
- 계약 갱신 시 구 계약의 PENDING 조항을 신규 계약으로 이관
- 테스트 3건 추가 (`clause.service.test.ts`)

### 6. AcademyFeePage UI 개선
- **파일**: `football/src/pages/youth/AcademyFeePage.tsx`
- `canApprove`: ADMIN / SUPER_ADMIN / GM / HR_MANAGER만 승인 버튼 노출
- `IssueFeeDialog` + "회비 등록" 버튼 추가 (기존에 버튼 자체가 없었음)
- "수동 접수" 버튼 → "영수증 업로드" 버튼으로 교체 (재무팀 전용, 파일 첨부)

### 7. 재무팀 영수증 업로드 엔드포인트
- **파일**: `apps/api/src/academy-fee/academy-fee.routes.ts`, `academyFee.service.ts`
- `POST /:id/staff-upload-proof` 추가
- 허용 역할: FINANCE_STAFF / FINANCE_MANAGER / ADMIN / SUPER_ADMIN / GM / TD
- 학부모가 오프라인으로 영수증 제출 → 재무팀원이 웹 업로드 → `SUBMITTED`
- 이후 재무팀장(FINANCE_MANAGER)이 `approve` → `PAID`

### 8. Sponsorship canWrite 버그 수정
- **파일**: `football/src/pages/sponsorship/SponsorshipPage.tsx`, `SponsorshipDetailPage.tsx`
- 기존 버그: `frontOfficeRole === 'GM'` 체크 (GM은 Role이라 항상 false)
- 수정: `user?.role === 'GM' || user?.role === 'SUPER_ADMIN'`으로 분리
- → GM/SUPER_ADMIN 계정에서 스폰서십 생성 버튼이 보이지 않던 문제 해결

## PR

- **Branch**: `fix/academy-fee-ui`
- **PR**: #293

## 백엔드 RBAC 기준 (`canWriteFinance`)

```ts
isAdminLike(role)  // ADMIN | SUPER_ADMIN | GM
|| (role === 'FRONT_OFFICE' && foRole === 'FINANCE_MANAGER')
```

FE `canWrite`는 이 기준과 동일하게 맞춤. `FINANCE_STAFF`는 read/upload만 가능, approve 불가.

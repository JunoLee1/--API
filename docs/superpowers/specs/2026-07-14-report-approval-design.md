# Director(GM) 보고서 결재 모듈 설계

**날짜:** 2026-07-14  
**상태:** 승인됨

---

## 개요

재무/성과 보고서를 작성자(Admin/감독)가 작성하고, GM(Director)이 승인·반려하는 3단계 결재 워크플로우를 구현한다.

---

## 1. 데이터 모델

```prisma
model Report {
  id              Int           @id @default(autoincrement())
  type            ReportType
  status          ReportStatus  @default(DRAFT)
  title           String
  content         String        @db.Text
  fileUrl         String?
  fileName        String?
  rejectionReason String?

  authorId        Int
  author          User          @relation(fields: [authorId], references: [id])

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  submittedAt     DateTime?
  reviewedAt      DateTime?
  reviewerId      Int?
  reviewer        User?         @relation("ReviewedReports", fields: [reviewerId], references: [id])
}

enum ReportType   { FINANCIAL PERFORMANCE }
enum ReportStatus { DRAFT SUBMITTED APPROVED REJECTED }
```

**작성 권한:**
- `FINANCIAL`: ADMIN
- `PERFORMANCE`: COACHING_STAFF (HEAD_COACH만)

**검토 권한:** GM(`frontOfficeRole: GM`)만 승인·반려 가능

---

## 2. 상태 전이

```
DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED
                            ──reject───▶ REJECTED ──submit──▶ SUBMITTED
```

- APPROVED 이후 수정·재제출 불가
- GM이 자신이 작성한 보고서는 승인 불가 (`authorId ≠ reviewerId`)

---

## 3. API 엔드포인트

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| `POST` | `/api/reports` | ADMIN, HEAD_COACH | 보고서 생성 (DRAFT) |
| `GET` | `/api/reports` | 작성자 본인 + GM | 목록 조회 |
| `GET` | `/api/reports/:id` | 작성자 본인 + GM | 상세 조회 |
| `PATCH` | `/api/reports/:id` | 작성자 본인 (DRAFT/REJECTED) | 내용 수정 |
| `POST` | `/api/reports/:id/submit` | 작성자 본인 (DRAFT/REJECTED) | 제출 |
| `POST` | `/api/reports/:id/approve` | GM (`FINANCE_APPROVE`) | 승인 |
| `POST` | `/api/reports/:id/reject` | GM (`FINANCE_APPROVE`) | 반려 (body: `{ reason }`) |
| `POST` | `/api/reports/upload` | ADMIN, HEAD_COACH | 파일 업로드 |

**파일 업로드:** multer, `/uploads/reports/` 로컬 저장, Express static 서빙

---

## 4. 권한 체계

`FINANCE_APPROVE`는 FRONT_OFFICE 전체가 아닌 GM sub-role에만 해당하므로, `ROLE_PERMISSIONS`에 추가하지 않는다. 대신 별도 헬퍼로 검증:

```typescript
// report.routes.ts
const requireGM = (req, res, next) => {
  if (req.user.role === 'FRONT_OFFICE' && req.user.frontOfficeRole === 'GM') return next()
  res.status(403).json({ message: '권한 없음' })
}
```

승인·반려 엔드포인트에 `requireGM` 미들웨어 적용.  
본인 보고서 소유권 검증은 서비스 레이어에서 처리.

---

## 5. UI 구성

**라우트:**

| 라우트 | 컴포넌트 | 접근 |
|--------|----------|------|
| `/reports` | `ReportsPage` | 작성자 + GM |
| `/reports/new` | `ReportFormPage` | ADMIN, HEAD_COACH |
| `/reports/:id` | `ReportDetailPage` | 작성자 + GM |
| `/reports/:id/edit` | `ReportFormPage` (편집 모드) | 작성자 (DRAFT/REJECTED) |

**주요 컴포넌트:**

- **ReportsPage**: 탭(전체/대기중/승인됨/반려됨) + 타입·상태 배지
- **ReportFormPage**: 제목 Input, 내용 Textarea, 파일 첨부, "임시저장" / "제출" 버튼
- **ReportDetailPage**:
  - 작성자 뷰: 반려 사유 표시(REJECTED), "수정하기" / "재제출" 버튼
  - GM 뷰: "승인" / "반려" 버튼 + 반려 사유 입력 Dialog
- **AppShell**: `관리` 섹션에 `보고서` nav 추가 (ADMIN, HEAD_COACH, FRONT_OFFICE/GM)

**WebSocket:** SUBMITTED 이벤트 → GM 알림 팝오버 카운트 증가 (기존 notification 인프라 활용)

---

## 6. 에러 처리

| 케이스 | 응답 |
|--------|------|
| APPROVED 보고서 수정·재제출 시도 | 403 |
| SUBMITTED 보고서 작성자 수정 시도 | 403 |
| GM이 자신의 보고서 승인 시도 | 403 |
| 존재하지 않는 보고서 | 404 |
| 반려 사유 없이 reject 호출 | 400 |

**AuditLog:** `approve`, `reject` 시 `writeAuditLog` 기록 (기존 `auditLog.ts` 재사용)

---

## 7. 파일 구조

```
apps/api/src/report/
  report.controller.ts
  report.service.ts
  report.repo.ts
  report.routes.ts

football/src/
  services/report.service.ts
  pages/reports/
    ReportsPage.tsx
    ReportFormPage.tsx
    ReportDetailPage.tsx
  hooks/useReportNotification.ts
```

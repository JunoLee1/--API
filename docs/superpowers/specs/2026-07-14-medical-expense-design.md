# 의료비 결재 모듈 Design Spec

**Date:** 2026-07-14  
**Goal:** 의료팀이 상신한 의료비를 MEDICAL_DIRECTOR(1차) → ADMIN(최종) 2단계로 결재하는 워크플로우 구현

---

## 1. 아키텍처

단일 `MedicalExpense` 테이블에 상태 컬럼으로 결재 단계를 관리한다.  
BE: Express 5 + Prisma 7, FE: React + shadcn/ui.  
파일 업로드는 multer, 로컬 저장(`uploads/medical-expenses/`).

---

## 2. 데이터 모델

### Enum

```prisma
enum ExpenseCostCategory {
  OUTPATIENT
  EXAMINATION
  SURGERY
  REHABILITATION
  MEDICATION
}

enum ExpensePayerType {
  CLUB
  ASSOCIATION
  INDIVIDUAL
}

enum MedicalExpenseStatus {
  DRAFT
  SUBMITTED
  LEADER_APPROVED
  APPROVED
  REJECTED
}
```

### MedicalExpense

```prisma
model MedicalExpense {
  id                Int                  @id @default(autoincrement())
  status            MedicalExpenseStatus @default(DRAFT)
  injuryId          Int?
  injury            Injury?              @relation(fields: [injuryId], references: [id])
  receiptDate       DateTime
  costCategory      ExpenseCostCategory
  totalAmount       Int
  payerType         ExpensePayerType
  description       String?
  fileUrl           String?
  fileName          String?
  rejectionReason   String?
  submittedById     Int
  submittedBy       User                 @relation("MedicalExpenseSubmitter", fields: [submittedById], references: [id])
  leaderReviewerId  Int?
  leaderReviewer    User?                @relation("MedicalExpenseLeaderReviewer", fields: [leaderReviewerId], references: [id])
  adminReviewerId   Int?
  adminReviewer     User?                @relation("MedicalExpenseAdminReviewer", fields: [adminReviewerId], references: [id])
  submittedAt       DateTime?
  leaderReviewedAt  DateTime?
  adminReviewedAt   DateTime?
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt
}
```

User 모델에 추가:
```prisma
submittedExpenses        MedicalExpense[] @relation("MedicalExpenseSubmitter")
leaderReviewedExpenses   MedicalExpense[] @relation("MedicalExpenseLeaderReviewer")
adminReviewedExpenses    MedicalExpense[] @relation("MedicalExpenseAdminReviewer")
```

---

## 3. 상태 전이

```
DRAFT ──submit──▶ SUBMITTED ──leader-approve──▶ LEADER_APPROVED ──approve──▶ APPROVED
  ▲                  │                                  │
  │            leader-reject                         reject
  │                  ▼                                  ▼
  └────────── REJECTED ◀────────────────────────────────
```

- REJECTED → 수정 후 재상신(submit) 가능

---

## 4. API 엔드포인트

Base path: `POST /api/medical-expenses`

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/` | 로그인 | 목록 (역할별 필터) |
| GET | `/:id` | 관련자 | 상세 조회 |
| POST | `/` | MEDICAL | 초안 생성 |
| PATCH | `/:id` | 본인 + DRAFT 상태 | 수정 |
| POST | `/:id/submit` | 본인 + DRAFT/REJECTED | 상신 |
| POST | `/:id/leader-approve` | MEDICAL_DIRECTOR | 1차 승인 |
| POST | `/:id/leader-reject` | MEDICAL_DIRECTOR | 1차 반려 |
| POST | `/:id/approve` | ADMIN | 최종 승인 |
| POST | `/:id/reject` | ADMIN | 최종 반려 |

**목록 권한 룰:**
- MEDICAL: 본인 작성 건만 (`submittedById === me`)
- MEDICAL_DIRECTOR: SUBMITTED 이후 전체
- ADMIN: 전체

---

## 5. 미들웨어

| 미들웨어 | 조건 |
|----------|------|
| `requireMedical` | `coachingRole === "MEDICAL"` |
| `requireMedicalDirector` | `coachingRole === "MEDICAL_DIRECTOR"` |
| `requireExpenseAuthor` | `expense.submittedById === req.user.id` |

---

## 6. UI 구성

### MedicalExpensesPage (`/medical-expenses`)
- 테이블: 날짜 / 항목 / 금액 / 납부주체 / 상태 뱃지
- MEDICAL: 본인 건만 / MEDICAL_DIRECTOR·ADMIN: 전체
- "비용 등록" 버튼 (MEDICAL만 노출)

### MedicalExpenseFormPage (`/medical-expenses/new`, `/medical-expenses/:id/edit`)
- 필드: 영수증날짜, 비용항목(Select), 금액, 납부주체(Select), 부상 연결(optional Select), 비고, 파일 업로드
- 버튼: 저장(DRAFT) / 상신
- DRAFT/REJECTED 상태 + 본인만 접근 가능

### MedicalExpenseDetailPage (`/medical-expenses/:id`)
- 모든 필드 읽기 전용
- 상태별 액션 버튼:
  - MEDICAL 본인 + DRAFT/REJECTED → 수정 / 상신
  - MEDICAL_DIRECTOR + SUBMITTED → 1차 승인 / 1차 반려
  - ADMIN + LEADER_APPROVED → 최종 승인 / 최종 반려
- 반려 사유 입력 Dialog

### AppShell LNB
- 부상·의료 섹션에 "의료비 결재" 추가
- 접근 역할: MEDICAL, MEDICAL_DIRECTOR, ADMIN

---

## 7. 알림 및 감사 로그

| 이벤트 | 알림 대상 | AuditLog |
|--------|----------|----------|
| 상신 | MEDICAL_DIRECTOR 전체 | - |
| 1차 승인 | ADMIN 전체 | ✓ |
| 1차 반려 | 작성자 | ✓ |
| 최종 승인 | 작성자 | ✓ |
| 최종 반려 | 작성자 | ✓ |

---

## 8. 에러 코드

| 코드 | HTTP | 상황 |
|------|------|------|
| `EXPENSE_NOT_FOUND` | 404 | ID 없음 |
| `INVALID_STATUS_TRANSITION` | 409 | 상태 전이 불가 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `INJURY_NOT_FOUND` | 404 | injuryId 연결 시 부상 없음 |

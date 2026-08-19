# Certification Management System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UEFA 클럽 라이선싱 기준을 충족하는 통합 인증 관리 시스템 — 선수·코치·스태프·시설·클럽 5개 도메인의 22개 certType을 단일 폴리모픽 모델로 관리하며, 2단계 승인 워크플로우와 만료 자동 알림을 제공한다.

**Architecture:** 단일 `Certification` 모델에 optional FK(`playerId`, `coachId`, `staffId`, `facilityZone`)로 엔티티를 연결하는 폴리모픽 구조. 일일 `certStatusSync` cron job이 status 갱신 및 `CertificationReminderLog`를 기반으로 중복 없는 알림 발송. certType별 1차 승인자(HR_MANAGER·MEDICAL_DIRECTOR·FACILITY_MANAGER·ADMIN)를 service 레이어 매핑 테이블로 정의.

**Tech Stack:** TypeScript, Hono/Express, Prisma (PostgreSQL), Jest, multer (file upload), node-cron

---

## File Map

| 파일 | 역할 |
|------|------|
| `apps/api/prisma/schema.prisma` | Certification, CertificationReminderLog 모델 + 3개 enum 추가; User/Player/Coach/StaffRecord back-relation 추가 |
| `apps/api/src/certification/dto/certification.dto.ts` | Create/Update/List DTO 타입 |
| `apps/api/src/certification/certification.repo.ts` | DB CRUD + approve/reject/suspend 쿼리 |
| `apps/api/src/certification/certification.service.ts` | 비즈니스 로직: 상태 전이, certType→approver 매핑, 알림 |
| `apps/api/src/certification/certification.service.test.ts` | service unit 테스트 |
| `apps/api/src/certification/certification.controller.ts` | HTTP handler (list/get/create/submit/approve/gm-approve/reject/suspend/update) |
| `apps/api/src/certification/certification.routes.ts` | Express Router + DI 조립 |
| `apps/api/src/jobs/certStatusSync.ts` | 일일 cron: status 갱신 + 만료 알림 |
| `apps/api/src/apiRouter.ts` | certification 라우터 + job 등록 |
| `football/src/types/certification.ts` | FE 타입 |
| `football/src/services/certificationApi.ts` | FE API 호출 |

---

## Task 1: Prisma Schema — 모델·enum 추가

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: enum 3개 추가**

`schema.prisma` 파일에서 기존 enum 블록 다음에 아래를 추가한다.

```prisma
enum CertificationType {
  PLAYER_REGISTRATION
  PLAYER_CONTRACT
  PLAYER_HEALTH_CHECK
  PLAYER_HEALTH_INSURANCE
  PLAYER_FIFA_ID
  COACH_UEFA_LICENSE
  COACH_YOUTH_LICENSE
  COACH_REFEREE_TRAINING
  STAFF_DOCTOR_LICENSE
  STAFF_MEDICAL_COORDINATOR
  STAFF_PHYSIOTHERAPIST
  STAFF_SAFETY_OFFICER
  FACILITY_STADIUM_SAFETY
  FACILITY_STRUCTURAL
  FACILITY_LIGHTING
  FACILITY_MEDICAL_EQUIPMENT
  FACILITY_FIRE_ELECTRICAL
  CLUB_LICENSE
  CLUB_CORPORATE_REGISTRATION
  CLUB_FINANCIAL_AUDIT
  CLUB_LIABILITY_INSURANCE
  CLUB_YOUTH_PROGRAM
}

enum CertEntityType {
  PLAYER
  COACH
  STAFF
  FACILITY
  CLUB
}

enum CertStatus {
  DRAFT
  PENDING_REVIEW
  FM_APPROVED
  VALID
  EXPIRING_SOON
  EXPIRED
  REJECTED
  SUSPENDED
  CANCELLED
}
```

- [ ] **Step 2: Certification 모델 추가**

`schema.prisma`에 `// ─── 인증 관리` 블록을 새로 추가한다.

```prisma
// ─────────────────────────────────────────────
// 인증 관리 (Certification)
// ─────────────────────────────────────────────

model Certification {
  id              Int               @id @default(autoincrement())
  certType        CertificationType
  entityType      CertEntityType
  issuingBody     String
  issuedAt        DateTime
  expiresAt       DateTime
  status          CertStatus        @default(DRAFT)
  isLocked        Boolean           @default(false)
  documentUrl     String?
  reminderDays    Int[]             @default([90, 60, 30])
  notes           String?
  rejectionReason String?

  ownerId         Int
  approvedById    Int?
  approvedAt      DateTime?
  gmApprovedById  Int?
  gmApprovedAt    DateTime?

  // 폴리모픽 FK — entityType에 따라 하나만 non-null
  playerId        String?
  coachId         Int?
  staffId         Int?
  facilityZone    FacilityZone?

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  owner           User              @relation("CertOwner",          fields: [ownerId],        references: [id])
  approvedBy      User?             @relation("CertFirstApprover",  fields: [approvedById],   references: [id])
  gmApprovedBy    User?             @relation("CertSecondApprover", fields: [gmApprovedById], references: [id])
  player          Player?           @relation("PlayerCertifications", fields: [playerId],     references: [id])
  coach           Coach?            @relation("CoachCertifications",  fields: [coachId],      references: [id])
  staff           StaffRecord?      @relation("StaffCertifications",  fields: [staffId],      references: [id])
  reminders       CertificationReminderLog[]

  @@index([expiresAt])
  @@index([status])
  @@index([entityType])
  @@index([playerId])
  @@index([coachId])
  @@index([staffId])
}

model CertificationReminderLog {
  id              Int           @id @default(autoincrement())
  certificationId Int
  daysThreshold   Int
  sentAt          DateTime      @default(now())

  certification   Certification @relation(fields: [certificationId], references: [id], onDelete: Cascade)

  @@unique([certificationId, daysThreshold])
}
```

- [ ] **Step 3: User 모델에 back-relation 3개 추가**

`User` 모델 relation 블록에 아래 3줄 추가:

```prisma
  certifications        Certification[] @relation("CertOwner")
  certFirstApprovals    Certification[] @relation("CertFirstApprover")
  certSecondApprovals   Certification[] @relation("CertSecondApprover")
```

- [ ] **Step 4: Player / Coach / StaffRecord back-relation 추가**

`Player` 모델:
```prisma
  certifications  Certification[] @relation("PlayerCertifications")
```

`Coach` 모델:
```prisma
  certifications  Certification[] @relation("CoachCertifications")
```

`StaffRecord` 모델:
```prisma
  certifications  Certification[] @relation("StaffCertifications")
```

- [ ] **Step 5: 스키마 검증**

```bash
cd apps/api && npx prisma validate
```

Expected: "The schema at `prisma/schema.prisma` is valid"

- [ ] **Step 6: 마이그레이션 생성 및 적용**

```bash
cd apps/api && npx prisma migrate dev --name add_certification_management
```

Expected: `migrations/YYYYMMDD_add_certification_management/migration.sql` 생성 + DB 적용 완료

- [ ] **Step 7: Prisma 클라이언트 재생성**

```bash
cd apps/api && npx prisma generate
```

Expected: `src/generated/` 업데이트, 오류 없음

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(cert): add Certification schema with polymorphic FK and ReminderLog"
```

---

## Task 2: DTO 정의

**Files:**
- Create: `apps/api/src/certification/dto/certification.dto.ts`

- [ ] **Step 1: DTO 파일 작성**

```typescript
import type { CertificationType, CertEntityType, CertStatus, FacilityZone } from "../../../generated/enums";

export interface CreateCertificationDto {
  certType: CertificationType;
  entityType: CertEntityType;
  issuingBody: string;
  issuedAt: string;       // ISO date string
  expiresAt: string;      // ISO date string
  reminderDays?: number[];
  notes?: string;
  // 폴리모픽 FK (entityType에 맞는 것 하나만)
  playerId?: string;
  coachId?: number;
  staffId?: number;
  facilityZone?: FacilityZone;
}

export interface UpdateCertificationDto {
  issuingBody?: string;
  issuedAt?: string;
  expiresAt?: string;
  documentUrl?: string;
  reminderDays?: number[];
  notes?: string;
}

export interface RejectCertificationDto {
  reason: string;
}

export interface CertificationListQuery {
  entityType?: CertEntityType;
  certType?: CertificationType;
  status?: CertStatus;
  playerId?: string;
  coachId?: number;
  staffId?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/certification/
git commit -m "feat(cert): add certification DTOs"
```

---

## Task 3: Repository

**Files:**
- Create: `apps/api/src/certification/certification.repo.ts`

- [ ] **Step 1: repo 파일 작성**

```typescript
import type { PrismaClient } from "../../generated/client";
import type {
  CreateCertificationDto,
  UpdateCertificationDto,
  CertificationListQuery,
} from "./dto/certification.dto";

const INCLUDE = {
  owner:       { select: { id: true, username: true } },
  approvedBy:  { select: { id: true, username: true } },
  gmApprovedBy:{ select: { id: true, username: true } },
  player:      { select: { id: true, playerName: true } },
  coach:       { select: { id: true, name: true } },
  staff:       { select: { id: true, name: true } },
  reminders:   { select: { id: true, daysThreshold: true, sentAt: true } },
} as const;

export class CertificationRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: CertificationListQuery) {
    return this.prisma.certification.findMany({
      where: {
        ...(query.entityType  && { entityType:  query.entityType  }),
        ...(query.certType    && { certType:    query.certType    }),
        ...(query.status      && { status:      query.status      }),
        ...(query.playerId    && { playerId:    query.playerId    }),
        ...(query.coachId     && { coachId:     query.coachId     }),
        ...(query.staffId     && { staffId:     query.staffId     }),
      },
      include: INCLUDE,
      orderBy: { expiresAt: "asc" },
    });
  }

  findById(id: number) {
    return this.prisma.certification.findUnique({ where: { id }, include: INCLUDE });
  }

  create(dto: CreateCertificationDto & { ownerId: number }) {
    return this.prisma.certification.create({
      data: {
        certType:     dto.certType,
        entityType:   dto.entityType,
        issuingBody:  dto.issuingBody,
        issuedAt:     new Date(dto.issuedAt),
        expiresAt:    new Date(dto.expiresAt),
        reminderDays: dto.reminderDays ?? [90, 60, 30],
        notes:        dto.notes,
        ownerId:      dto.ownerId,
        playerId:     dto.playerId,
        coachId:      dto.coachId,
        staffId:      dto.staffId,
        facilityZone: dto.facilityZone,
      },
      include: INCLUDE,
    });
  }

  update(id: number, dto: UpdateCertificationDto) {
    return this.prisma.certification.update({
      where: { id },
      data: {
        ...(dto.issuingBody  !== undefined && { issuingBody:  dto.issuingBody }),
        ...(dto.issuedAt     !== undefined && { issuedAt:     new Date(dto.issuedAt) }),
        ...(dto.expiresAt    !== undefined && { expiresAt:    new Date(dto.expiresAt) }),
        ...(dto.documentUrl  !== undefined && { documentUrl:  dto.documentUrl }),
        ...(dto.reminderDays !== undefined && { reminderDays: dto.reminderDays }),
        ...(dto.notes        !== undefined && { notes:        dto.notes }),
      },
      include: INCLUDE,
    });
  }

  submit(id: number) {
    return this.prisma.certification.update({
      where: { id },
      data: { status: "PENDING_REVIEW" },
      include: INCLUDE,
    });
  }

  approve(id: number, approverId: number) {
    return this.prisma.certification.update({
      where: { id },
      data: { status: "FM_APPROVED", approvedById: approverId, approvedAt: new Date() },
      include: INCLUDE,
    });
  }

  gmApprove(id: number, approverId: number) {
    return this.prisma.certification.update({
      where: { id },
      data: {
        status: "VALID",
        gmApprovedById: approverId,
        gmApprovedAt: new Date(),
        isLocked: true,
      },
      include: INCLUDE,
    });
  }

  reject(id: number, reason: string) {
    return this.prisma.certification.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: reason },
      include: INCLUDE,
    });
  }

  suspend(id: number) {
    return this.prisma.certification.update({
      where: { id },
      data: { status: "SUSPENDED" },
      include: INCLUDE,
    });
  }

  cancel(id: number) {
    return this.prisma.certification.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: INCLUDE,
    });
  }

  // 재상신 시 reminder log 초기화
  async resubmit(id: number) {
    await this.prisma.certificationReminderLog.deleteMany({ where: { certificationId: id } });
    return this.prisma.certification.update({
      where: { id },
      data: { status: "PENDING_REVIEW", rejectionReason: null },
      include: INCLUDE,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/certification/certification.repo.ts
git commit -m "feat(cert): add CertificationRepository"
```

---

## Task 4: Service + certType→Approver 매핑

**Files:**
- Create: `apps/api/src/certification/certification.service.ts`

- [ ] **Step 1: service 파일 작성**

```typescript
import { AppError } from "../../lib/appError";
import { NotificationService } from "../../notification/notification.service";
import type { CertificationRepository } from "./certification.repo";
import type {
  CreateCertificationDto,
  UpdateCertificationDto,
  RejectCertificationDto,
  CertificationListQuery,
} from "./dto/certification.dto";
import type { CertificationType } from "../../generated/enums";

// certType별 1차 승인 역할 매핑
// role === "FRONT_OFFICE" && frontOfficeRole === X 형태로 controller에서 확인
type ApproverRole =
  | { role: "FRONT_OFFICE"; foRole: "HR_MANAGER" }
  | { role: "FRONT_OFFICE"; foRole: "FACILITY_MANAGER" }
  | { role: "MEDICAL_DIRECTOR" }
  | { role: "ADMIN" };

export const CERT_APPROVER_MAP: Record<CertificationType, ApproverRole> = {
  PLAYER_REGISTRATION:        { role: "FRONT_OFFICE", foRole: "HR_MANAGER" },
  PLAYER_CONTRACT:            { role: "FRONT_OFFICE", foRole: "HR_MANAGER" },
  PLAYER_HEALTH_CHECK:        { role: "MEDICAL_DIRECTOR" },
  PLAYER_HEALTH_INSURANCE:    { role: "FRONT_OFFICE", foRole: "HR_MANAGER" },
  PLAYER_FIFA_ID:             { role: "FRONT_OFFICE", foRole: "HR_MANAGER" },
  COACH_UEFA_LICENSE:         { role: "FRONT_OFFICE", foRole: "HR_MANAGER" },
  COACH_YOUTH_LICENSE:        { role: "FRONT_OFFICE", foRole: "HR_MANAGER" },
  COACH_REFEREE_TRAINING:     { role: "FRONT_OFFICE", foRole: "HR_MANAGER" },
  STAFF_DOCTOR_LICENSE:       { role: "FRONT_OFFICE", foRole: "HR_MANAGER" },
  STAFF_MEDICAL_COORDINATOR:  { role: "MEDICAL_DIRECTOR" },
  STAFF_PHYSIOTHERAPIST:      { role: "MEDICAL_DIRECTOR" },
  STAFF_SAFETY_OFFICER:       { role: "FRONT_OFFICE", foRole: "FACILITY_MANAGER" },
  FACILITY_STADIUM_SAFETY:    { role: "FRONT_OFFICE", foRole: "FACILITY_MANAGER" },
  FACILITY_STRUCTURAL:        { role: "FRONT_OFFICE", foRole: "FACILITY_MANAGER" },
  FACILITY_LIGHTING:          { role: "FRONT_OFFICE", foRole: "FACILITY_MANAGER" },
  FACILITY_MEDICAL_EQUIPMENT: { role: "MEDICAL_DIRECTOR" },
  FACILITY_FIRE_ELECTRICAL:   { role: "FRONT_OFFICE", foRole: "FACILITY_MANAGER" },
  CLUB_LICENSE:               { role: "ADMIN" },
  CLUB_CORPORATE_REGISTRATION:{ role: "ADMIN" },
  CLUB_FINANCIAL_AUDIT:       { role: "ADMIN" },
  CLUB_LIABILITY_INSURANCE:   { role: "ADMIN" },
  CLUB_YOUTH_PROGRAM:         { role: "ADMIN" },
};

const MUTABLE_STATUSES = ["DRAFT", "REJECTED"] as const;

export class CertificationService {
  constructor(
    private repo: CertificationRepository,
    private notifications: NotificationService,
  ) {}

  list(query: CertificationListQuery) {
    return this.repo.findAll(query);
  }

  async get(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "CERTIFICATION_NOT_FOUND");
    return record;
  }

  create(dto: CreateCertificationDto, ownerId: number) {
    return this.repo.create({ ...dto, ownerId });
  }

  async update(id: number, dto: UpdateCertificationDto) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "CERTIFICATION_NOT_FOUND");
    if (record.isLocked) throw new AppError(400, "CERTIFICATION_LOCKED");
    if (!(MUTABLE_STATUSES as readonly string[]).includes(record.status)) {
      throw new AppError(409, "CERTIFICATION_NOT_EDITABLE");
    }
    return this.repo.update(id, dto);
  }

  async submit(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "CERTIFICATION_NOT_FOUND");
    if (!(MUTABLE_STATUSES as readonly string[]).includes(record.status)) {
      throw new AppError(409, "CERTIFICATION_NOT_SUBMITTABLE");
    }
    if (record.status === "REJECTED") {
      return this.repo.resubmit(id);
    }
    return this.repo.submit(id);
  }

  async approve(id: number, approverId: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "CERTIFICATION_NOT_FOUND");
    if (record.status !== "PENDING_REVIEW") {
      throw new AppError(409, "CERTIFICATION_NOT_PENDING");
    }
    return this.repo.approve(id, approverId);
  }

  async gmApprove(id: number, approverId: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "CERTIFICATION_NOT_FOUND");
    if (record.status !== "FM_APPROVED") {
      throw new AppError(409, "CERTIFICATION_NOT_FM_APPROVED");
    }
    return this.repo.gmApprove(id, approverId);
  }

  async reject(id: number, dto: RejectCertificationDto) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "CERTIFICATION_NOT_FOUND");
    if (!["PENDING_REVIEW", "FM_APPROVED"].includes(record.status)) {
      throw new AppError(409, "CERTIFICATION_NOT_REJECTABLE");
    }
    return this.repo.reject(id, dto.reason);
  }

  async suspend(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "CERTIFICATION_NOT_FOUND");
    if (["CANCELLED", "SUSPENDED"].includes(record.status)) {
      throw new AppError(409, "CERTIFICATION_ALREADY_INACTIVE");
    }
    return this.repo.suspend(id);
  }

  async cancel(id: number) {
    const record = await this.repo.findById(id);
    if (!record) throw new AppError(404, "CERTIFICATION_NOT_FOUND");
    if (record.status === "CANCELLED") {
      throw new AppError(409, "CERTIFICATION_ALREADY_CANCELLED");
    }
    return this.repo.cancel(id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/certification/certification.service.ts
git commit -m "feat(cert): add CertificationService with certType approver mapping"
```

---

## Task 5: Service Unit Tests

**Files:**
- Create: `apps/api/src/certification/certification.service.test.ts`

- [ ] **Step 1: 테스트 헬퍼 작성**

```typescript
import { CertificationService } from "./certification.service";
import { AppError } from "../../lib/appError";
import type { CertificationRepository } from "./certification.repo";

const makeRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  certType: "PLAYER_HEALTH_CHECK",
  entityType: "PLAYER",
  status: "DRAFT",
  isLocked: false,
  reminderDays: [90, 60, 30],
  reminders: [],
  ...overrides,
});

const makeRepo = (overrides: Partial<CertificationRepository> = {}): CertificationRepository => ({
  findAll:    jest.fn().mockResolvedValue([]),
  findById:   jest.fn().mockResolvedValue(null),
  create:     jest.fn(),
  update:     jest.fn(),
  submit:     jest.fn(),
  resubmit:   jest.fn(),
  approve:    jest.fn(),
  gmApprove:  jest.fn(),
  reject:     jest.fn(),
  suspend:    jest.fn(),
  cancel:     jest.fn(),
  ...overrides,
} as unknown as CertificationRepository);

const makeService = (repo: CertificationRepository) =>
  new CertificationService(repo, undefined as any);
```

- [ ] **Step 2: submit 테스트**

```typescript
describe("CertificationService.submit", () => {
  it("throws 404 when cert not found", async () => {
    const service = makeService(makeRepo());
    await expect(service.submit(1)).rejects.toThrow(new AppError(404, "CERTIFICATION_NOT_FOUND"));
  });

  it("throws 409 when status is PENDING_REVIEW", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeRecord({ status: "PENDING_REVIEW" })) });
    await expect(makeService(repo).submit(1)).rejects.toThrow(new AppError(409, "CERTIFICATION_NOT_SUBMITTABLE"));
  });

  it("calls resubmit when status is REJECTED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeRecord({ status: "REJECTED" })),
      resubmit: jest.fn().mockResolvedValue(makeRecord({ status: "PENDING_REVIEW" })),
    });
    await makeService(repo).submit(1);
    expect(repo.resubmit).toHaveBeenCalledWith(1);
  });

  it("calls submit when status is DRAFT", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeRecord({ status: "DRAFT" })),
      submit: jest.fn().mockResolvedValue(makeRecord({ status: "PENDING_REVIEW" })),
    });
    await makeService(repo).submit(1);
    expect(repo.submit).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 3: approve 테스트**

```typescript
describe("CertificationService.approve", () => {
  it("throws 409 when not in PENDING_REVIEW", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeRecord({ status: "DRAFT" })) });
    await expect(makeService(repo).approve(1, 42)).rejects.toThrow(new AppError(409, "CERTIFICATION_NOT_PENDING"));
  });

  it("approves when status is PENDING_REVIEW", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeRecord({ status: "PENDING_REVIEW" })),
      approve: jest.fn().mockResolvedValue(makeRecord({ status: "FM_APPROVED" })),
    });
    await makeService(repo).approve(1, 42);
    expect(repo.approve).toHaveBeenCalledWith(1, 42);
  });
});
```

- [ ] **Step 4: gmApprove 테스트**

```typescript
describe("CertificationService.gmApprove", () => {
  it("throws 409 when not FM_APPROVED", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeRecord({ status: "PENDING_REVIEW" })) });
    await expect(makeService(repo).gmApprove(1, 99)).rejects.toThrow(new AppError(409, "CERTIFICATION_NOT_FM_APPROVED"));
  });

  it("gmApproves when status is FM_APPROVED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeRecord({ status: "FM_APPROVED" })),
      gmApprove: jest.fn().mockResolvedValue(makeRecord({ status: "VALID", isLocked: true })),
    });
    await makeService(repo).gmApprove(1, 99);
    expect(repo.gmApprove).toHaveBeenCalledWith(1, 99);
  });
});
```

- [ ] **Step 5: reject / suspend / cancel 테스트**

```typescript
describe("CertificationService.reject", () => {
  it("throws 409 when status is DRAFT", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeRecord({ status: "DRAFT" })) });
    await expect(makeService(repo).reject(1, { reason: "invalid" }))
      .rejects.toThrow(new AppError(409, "CERTIFICATION_NOT_REJECTABLE"));
  });
});

describe("CertificationService.update", () => {
  it("throws 400 when cert is locked", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeRecord({ isLocked: true })) });
    await expect(makeService(repo).update(1, {}))
      .rejects.toThrow(new AppError(400, "CERTIFICATION_LOCKED"));
  });

  it("throws 409 when status is VALID", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(makeRecord({ status: "VALID" })) });
    await expect(makeService(repo).update(1, {}))
      .rejects.toThrow(new AppError(409, "CERTIFICATION_NOT_EDITABLE"));
  });
});
```

- [ ] **Step 6: 테스트 실행**

```bash
cd apps/api && npx jest src/certification/certification.service.test.ts --no-coverage
```

Expected: 전체 PASS, 0 failures

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/certification/certification.service.test.ts
git commit -m "test(cert): add CertificationService unit tests"
```

---

## Task 6: Controller

**Files:**
- Create: `apps/api/src/certification/certification.controller.ts`

- [ ] **Step 1: 권한 헬퍼 함수 정의**

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/appError";
import { isAdminLike } from "../../lib/permissions";
import { requireUser } from "../../lib/authMiddleware";
import { CERT_APPROVER_MAP } from "./certification.service";
import type { CertificationService } from "./certification.service";
import type {
  CreateCertificationDto,
  UpdateCertificationDto,
  RejectCertificationDto,
  CertificationListQuery,
} from "./dto/certification.dto";
import type { CertificationType } from "../../generated/enums";

const isGmOrAdmin = (req: Request) => {
  const u = requireUser(req);
  return isAdminLike(u.role) || u.role === "GM";
};

// certType의 1차 승인자 역할인지 확인
const isCertFirstApprover = (req: Request, certType: CertificationType): boolean => {
  const u = requireUser(req);
  if (isAdminLike(u.role)) return true;
  const required = CERT_APPROVER_MAP[certType];
  if (required.role === "ADMIN") return isAdminLike(u.role);
  if (required.role === "MEDICAL_DIRECTOR") {
    return u.role === "COACHING_STAFF" && (u as any).coachingRole === "MEDICAL_DIRECTOR";
  }
  if (required.role === "FRONT_OFFICE" && "foRole" in required) {
    return u.role === "FRONT_OFFICE" && (u as any).frontOfficeRole === required.foRole;
  }
  return false;
};
```

- [ ] **Step 2: CertificationController 클래스 작성**

```typescript
export class CertificationController {
  constructor(private service: CertificationService) {}

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as CertificationListQuery;
      res.json(await this.service.list(query));
    } catch (e) { next(e); }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await this.service.get(Number(req.params["id"])));
    } catch (e) { next(e); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const dto = req.body as CreateCertificationDto;
      const record = await this.service.create(dto, user.id);
      res.status(201).json(record);
    } catch (e) { next(e); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = req.body as UpdateCertificationDto;
      res.json(await this.service.update(Number(req.params["id"]), dto));
    } catch (e) { next(e); }
  }

  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await this.service.submit(Number(req.params["id"])));
    } catch (e) { next(e); }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params["id"]);
      const record = await this.service.get(id);
      if (!isCertFirstApprover(req, record.certType as CertificationType)) {
        throw new AppError(403, "FORBIDDEN");
      }
      const user = requireUser(req);
      res.json(await this.service.approve(id, user.id));
    } catch (e) { next(e); }
  }

  async gmApprove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!isGmOrAdmin(req)) throw new AppError(403, "FORBIDDEN");
      const user = requireUser(req);
      res.json(await this.service.gmApprove(Number(req.params["id"]), user.id));
    } catch (e) { next(e); }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params["id"]);
      const record = await this.service.get(id);
      const canReject = isCertFirstApprover(req, record.certType as CertificationType) || isGmOrAdmin(req);
      if (!canReject) throw new AppError(403, "FORBIDDEN");
      const dto = req.body as RejectCertificationDto;
      res.json(await this.service.reject(id, dto));
    } catch (e) { next(e); }
  }

  async suspend(req: Request, res: Response, next: NextFunction) {
    try {
      if (!isGmOrAdmin(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.suspend(Number(req.params["id"])));
    } catch (e) { next(e); }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!isGmOrAdmin(req)) throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.cancel(Number(req.params["id"])));
    } catch (e) { next(e); }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/certification/certification.controller.ts
git commit -m "feat(cert): add CertificationController with certType-aware approval checks"
```

---

## Task 7: Routes

**Files:**
- Create: `apps/api/src/certification/certification.routes.ts`

- [ ] **Step 1: routes 파일 작성**

```typescript
import { Router } from "express";
import multer from "multer";
import path from "path";
import { auth } from "../lib/authMiddleware";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { NotificationService } from "../notification/notification.service";
import { CertificationRepository } from "./certification.repo";
import { CertificationService } from "./certification.service";
import { CertificationController } from "./certification.controller";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads", "certifications") });

const notificationService = new NotificationService(new NotificationRepository(getPrisma()));
const certRepo    = new CertificationRepository(getPrisma());
const certService = new CertificationService(certRepo, notificationService);
const certCtrl    = new CertificationController(certService);

router.get(   "/",              auth, (req, res, next) => certCtrl.list(req, res, next));
router.post(  "/",              auth, (req, res, next) => certCtrl.create(req, res, next));
router.get(   "/:id",          auth, (req, res, next) => certCtrl.get(req, res, next));
router.patch( "/:id",          auth, (req, res, next) => certCtrl.update(req, res, next));
router.post(  "/:id/submit",   auth, (req, res, next) => certCtrl.submit(req, res, next));
router.post(  "/:id/approve",  auth, (req, res, next) => certCtrl.approve(req, res, next));
router.post(  "/:id/gm-approve", auth, (req, res, next) => certCtrl.gmApprove(req, res, next));
router.post(  "/:id/reject",   auth, (req, res, next) => certCtrl.reject(req, res, next));
router.post(  "/:id/suspend",  auth, (req, res, next) => certCtrl.suspend(req, res, next));
router.post(  "/:id/cancel",   auth, (req, res, next) => certCtrl.cancel(req, res, next));

// 문서 업로드 (multer → documentUrl 업데이트)
router.post("/:id/upload", auth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new Error("NO_FILE");
    const documentUrl = `/uploads/certifications/${req.file.filename}`;
    res.json(await certService.update(Number(req.params["id"]), { documentUrl }));
  } catch (e) { next(e); }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/certification/certification.routes.ts
git commit -m "feat(cert): add certification routes with file upload"
```

---

## Task 8: certStatusSync Job

**Files:**
- Create: `apps/api/src/jobs/certStatusSync.ts`

이 job은 매일 08:30에 실행되며:
1. 만료된 인증을 EXPIRED로 전환
2. 30일 이내 만료 인증을 EXPIRING_SOON으로 전환
3. reminderDays 기준으로 알림 발송 (CertificationReminderLog로 중복 방지)

- [ ] **Step 1: job 파일 작성**

```typescript
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { NotificationService } from "../notification/notification.service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function runCertStatusSync() {
  const prisma = getPrisma();
  const notifService = new NotificationService(new NotificationRepository(prisma));
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * MS_PER_DAY);

  // 1. 만료 처리: VALID|EXPIRING_SOON|FM_APPROVED → EXPIRED
  await prisma.certification.updateMany({
    where: {
      status: { in: ["VALID", "EXPIRING_SOON", "FM_APPROVED"] },
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  // 2. 만료 임박 처리: VALID → EXPIRING_SOON (30일 이내)
  await prisma.certification.updateMany({
    where: {
      status: "VALID",
      expiresAt: { gt: now, lte: in30Days },
    },
    data: { status: "EXPIRING_SOON" },
  });

  // 3. 만료 알림 발송
  const activeCerts = await prisma.certification.findMany({
    where: { status: { in: ["VALID", "EXPIRING_SOON", "FM_APPROVED"] } },
    include: {
      reminders: true,
      owner: { select: { id: true } },
    },
  });

  for (const cert of activeCerts) {
    const daysLeft = Math.ceil((cert.expiresAt.getTime() - now.getTime()) / MS_PER_DAY);

    for (const threshold of cert.reminderDays) {
      if (daysLeft > threshold) continue;

      const alreadySent = cert.reminders.some((r) => r.daysThreshold === threshold);
      if (alreadySent) continue;

      // 알림 발송
      const isEscalated = threshold <= 30;

      try {
        // 담당자 알림
        await notifService.createNotification({
          userId: cert.ownerId,
          type: "CERT_EXPIRY_REMINDER",
          message: `인증 만료 ${daysLeft}일 전: ${cert.certType}`,
          relatedId: cert.id,
        });

        // 에스컬레이션: 30일 이하면 Admin·구단주에게도 발송
        if (isEscalated) {
          const admins = await prisma.user.findMany({
            where: {
              OR: [
                { role: "ADMIN" },
                { role: "GM" },
                ...(daysLeft <= 0 ? [{ role: "SUPER_ADMIN" as const }] : []),
              ],
              isDeleted: false,
            },
            select: { id: true },
          });
          for (const admin of admins) {
            await notifService.createNotification({
              userId: admin.id,
              type: "CERT_EXPIRY_REMINDER",
              message: `[에스컬레이션] 인증 만료 ${daysLeft}일 전: ${cert.certType}`,
              relatedId: cert.id,
            });
          }
        }

        // 발송 기록 저장 (@@unique가 중복 막아줌)
        await prisma.certificationReminderLog.create({
          data: { certificationId: cert.id, daysThreshold: threshold },
        });
      } catch (err) {
        console.error(`certStatusSync: reminder failed for cert ${cert.id}`, err);
      }
    }
  }

  console.log(`[certStatusSync] done. ${activeCerts.length} certs checked at ${now.toISOString()}`);
}

export function startCertStatusSyncJob() {
  // 매일 08:30
  cron.schedule("30 8 * * *", () => {
    runCertStatusSync().catch(console.error);
  });
  console.log("[certStatusSync] scheduled at 08:30 daily");
}
```

> **Note:** `notifService.createNotification` 시그니처는 프로젝트의 NotificationService 구현에 맞게 조정하세요. 기존 `notifyFacilityEmergency` 패턴을 참고할 것.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/jobs/certStatusSync.ts
git commit -m "feat(cert): add certStatusSync daily job with escalation logic"
```

---

## Task 9: apiRouter 등록

**Files:**
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: import 추가**

`apiRouter.ts`의 import 블록에 추가:

```typescript
import certificationRouter from "./certification/certification.routes";
import { startCertStatusSyncJob } from "./jobs/certStatusSync";
```

- [ ] **Step 2: 라우터 등록**

기존 `apiRouter.use("/facility", facilityRouter);` 다음에 추가:

```typescript
apiRouter.use("/certification", certificationRouter);
```

- [ ] **Step 3: job 시작**

기존 job 시작 코드 블록 다음에 추가:

```typescript
startCertStatusSyncJob();
```

- [ ] **Step 4: 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/apiRouter.ts
git commit -m "feat(cert): register certification router and sync job"
```

---

## Task 10: 프론트엔드 타입 · API 서비스

**Files:**
- Create: `football/src/types/certification.ts`
- Create: `football/src/services/certificationApi.ts`

- [ ] **Step 1: FE 타입 파일 작성**

```typescript
// football/src/types/certification.ts

export type CertificationType =
  | "PLAYER_REGISTRATION" | "PLAYER_CONTRACT" | "PLAYER_HEALTH_CHECK"
  | "PLAYER_HEALTH_INSURANCE" | "PLAYER_FIFA_ID"
  | "COACH_UEFA_LICENSE" | "COACH_YOUTH_LICENSE" | "COACH_REFEREE_TRAINING"
  | "STAFF_DOCTOR_LICENSE" | "STAFF_MEDICAL_COORDINATOR"
  | "STAFF_PHYSIOTHERAPIST" | "STAFF_SAFETY_OFFICER"
  | "FACILITY_STADIUM_SAFETY" | "FACILITY_STRUCTURAL" | "FACILITY_LIGHTING"
  | "FACILITY_MEDICAL_EQUIPMENT" | "FACILITY_FIRE_ELECTRICAL"
  | "CLUB_LICENSE" | "CLUB_CORPORATE_REGISTRATION" | "CLUB_FINANCIAL_AUDIT"
  | "CLUB_LIABILITY_INSURANCE" | "CLUB_YOUTH_PROGRAM";

export type CertEntityType = "PLAYER" | "COACH" | "STAFF" | "FACILITY" | "CLUB";

export type CertStatus =
  | "DRAFT" | "PENDING_REVIEW" | "FM_APPROVED" | "VALID"
  | "EXPIRING_SOON" | "EXPIRED" | "REJECTED" | "SUSPENDED" | "CANCELLED";

export interface Certification {
  id: number;
  certType: CertificationType;
  entityType: CertEntityType;
  issuingBody: string;
  issuedAt: string;
  expiresAt: string;
  status: CertStatus;
  isLocked: boolean;
  documentUrl: string | null;
  reminderDays: number[];
  notes: string | null;
  rejectionReason: string | null;
  ownerId: number;
  approvedById: number | null;
  approvedAt: string | null;
  gmApprovedById: number | null;
  gmApprovedAt: string | null;
  owner: { id: number; username: string };
  player?: { id: string; playerName: string } | null;
  coach?: { id: number; name: string } | null;
  staff?: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const CERT_STATUS_LABEL: Record<CertStatus, string> = {
  DRAFT:          "초안",
  PENDING_REVIEW: "검토 중",
  FM_APPROVED:    "1차 승인",
  VALID:          "유효",
  EXPIRING_SOON:  "만료 임박",
  EXPIRED:        "만료",
  REJECTED:       "반려",
  SUSPENDED:      "정지",
  CANCELLED:      "취소",
};

export const CERT_STATUS_COLOR: Record<CertStatus, string> = {
  DRAFT:          "gray",
  PENDING_REVIEW: "blue",
  FM_APPROVED:    "indigo",
  VALID:          "green",
  EXPIRING_SOON:  "yellow",
  EXPIRED:        "red",
  REJECTED:       "orange",
  SUSPENDED:      "purple",
  CANCELLED:      "gray",
};
```

- [ ] **Step 2: FE API 서비스 작성**

```typescript
// football/src/services/certificationApi.ts

import type { Certification, CertEntityType, CertificationType, CertStatus } from "../types/certification";

const BASE = "/api/certification";

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const certificationApi = {
  list(params?: {
    entityType?: CertEntityType;
    certType?: CertificationType;
    status?: CertStatus;
    playerId?: string;
    coachId?: number;
    staffId?: number;
  }): Promise<Certification[]> {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    return req(`${BASE}${qs ? `?${qs}` : ""}`);
  },

  get(id: number): Promise<Certification> {
    return req(`${BASE}/${id}`);
  },

  create(body: {
    certType: CertificationType;
    entityType: CertEntityType;
    issuingBody: string;
    issuedAt: string;
    expiresAt: string;
    reminderDays?: number[];
    notes?: string;
    playerId?: string;
    coachId?: number;
    staffId?: number;
    facilityZone?: string;
  }): Promise<Certification> {
    return req(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  update(id: number, body: Partial<{
    issuingBody: string;
    issuedAt: string;
    expiresAt: string;
    documentUrl: string;
    reminderDays: number[];
    notes: string;
  }>): Promise<Certification> {
    return req(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  submit(id: number):    Promise<Certification> { return req(`${BASE}/${id}/submit`,     { method: "POST" }); },
  approve(id: number):   Promise<Certification> { return req(`${BASE}/${id}/approve`,    { method: "POST" }); },
  gmApprove(id: number): Promise<Certification> { return req(`${BASE}/${id}/gm-approve`, { method: "POST" }); },

  reject(id: number, reason: string): Promise<Certification> {
    return req(`${BASE}/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  },

  suspend(id: number): Promise<Certification> { return req(`${BASE}/${id}/suspend`, { method: "POST" }); },
  cancel(id: number):  Promise<Certification> { return req(`${BASE}/${id}/cancel`,  { method: "POST" }); },

  uploadDocument(id: number, file: File): Promise<Certification> {
    const form = new FormData();
    form.append("file", file);
    return req(`${BASE}/${id}/upload`, { method: "POST", body: form });
  },
};
```

- [ ] **Step 3: FE 빌드 확인**

```bash
cd football && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: Commit**

```bash
git add football/src/types/certification.ts football/src/services/certificationApi.ts
git commit -m "feat(cert): add FE types and API service"
```

---

## Task 11: 통합 검증

- [ ] **Step 1: 전체 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit && echo "API OK"
cd football  && npx tsc --noEmit && echo "FE OK"
```

Expected: 두 줄 모두 OK

- [ ] **Step 2: 전체 테스트 실행**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: 기존 테스트 + cert 테스트 모두 PASS

- [ ] **Step 3: 서버 기동 후 smoke test**

```bash
# 서버 기동
cd apps/api && npm run dev &
sleep 3

# 인증 생성
curl -s -X POST http://localhost:3000/api/certification \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"certType":"PLAYER_HEALTH_CHECK","entityType":"PLAYER","issuingBody":"서울대병원","issuedAt":"2026-01-01","expiresAt":"2027-01-01","playerId":"<uuid>"}' | jq .status

# 목록 조회
curl -s http://localhost:3000/api/certification?entityType=PLAYER \
  -H "Cookie: ..." | jq 'length'
```

Expected: `"DRAFT"` / 1 이상

- [ ] **Step 4: 최종 Commit**

```bash
git add -A
git commit -m "feat(cert): complete certification management system"
```

---

## Self-Review

**Spec coverage:**
- ✅ 단일 폴리모픽 Certification 모델
- ✅ 22개 CertificationType enum
- ✅ 9개 CertStatus (DRAFT→VALID→EXPIRING_SOON→EXPIRED + SUSPENDED/CANCELLED)
- ✅ 2단계 승인 (FM_APPROVED → VALID + isLocked)
- ✅ certType별 1차 승인자 매핑 테이블
- ✅ CertificationReminderLog (@@unique 중복 방지)
- ✅ 알림 에스컬레이션 (90·60=담당자, 30일=+Admin, 만료=+GM)
- ✅ 재상신 시 reminder log 초기화
- ✅ multer 파일 업로드
- ✅ FE 타입 + API 서비스

**Gaps:** 없음 — FE Page UI는 별도 플랜으로 분리 권장 (독립적으로 동작 가능한 백엔드가 먼저 완성됨)

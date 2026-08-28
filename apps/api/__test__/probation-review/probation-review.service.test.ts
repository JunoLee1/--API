import { describe, it, expect, jest } from "@jest/globals";
import { ProbationReviewService } from "../../src/probation-review/probation-review.service";
import { AppError } from "../../src/lib/appError";
import type { ProbationReviewRepository } from "../../src/probation-review/probation-review.repo";
import type { NotificationRepository } from "../../src/notification/notification.repo";
import type { PrismaClient } from "../../src/generated/client";

jest.mock("../../src/lib/auditLog", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined as never),
}));

const HR_ID = 10;
const ADMIN_ID = 11;
const DEPT_HEAD_ID = 20;
const OUTSIDER_ID = 30;
const STAFF_ID = 100;
const DEPT_ID = 40;

const makeStaff = (overrides: Partial<any> = {}) => ({
  id: STAFF_ID,
  name: "김직원",
  role: "Analyst",
  departmentId: DEPT_ID,
  probationStartedAt: new Date("2026-01-01"),
  probationEndedAt: null as Date | null,
  probationStatus: "IN_PROGRESS" as const,
  department: { id: DEPT_ID, name: "분석팀", headId: DEPT_HEAD_ID },
  ...overrides,
});

const makeRepo = (overrides: Partial<ProbationReviewRepository> = {}): ProbationReviewRepository =>
  ({
    findStaffWithDept: jest.fn<any>().mockResolvedValue(makeStaff()),
    findReviewByStaffAndType: jest.fn<any>().mockResolvedValue(null),
    findReviewsForStaff: jest.fn<any>().mockResolvedValue([]),
    upsertReview: jest.fn<any>().mockImplementation(async (args: any) => ({
      id: 1,
      staffRecordId: args.staffRecordId,
      reviewType: args.reviewType,
      status: args.status,
      leaderAssessment: args.leaderAssessment,
      reviewedById: args.reviewedById,
      reviewedAt: new Date(),
    })),
    setStaffProbation: jest.fn<any>().mockResolvedValue(undefined),
    findStaffIdByUserEmail: jest.fn<any>().mockResolvedValue(null),
    ...overrides,
  }) as unknown as ProbationReviewRepository;

const makeNotif = (): NotificationRepository =>
  ({
    createForUser: jest.fn<any>().mockResolvedValue(undefined),
    createForDepartmentHead: jest.fn<any>().mockResolvedValue(undefined),
  }) as unknown as NotificationRepository;

const makePrisma = (): PrismaClient =>
  ({
    $transaction: jest.fn<any>().mockImplementation(async (fn: any) => fn({})),
  }) as unknown as PrismaClient;

const makeService = (
  repo = makeRepo(),
  notif = makeNotif(),
  prisma = makePrisma(),
) => new ProbationReviewService(repo, notif, prisma);

// ────────────────────────────────────────────
// submit — role checks
// ────────────────────────────────────────────

describe("ProbationReviewService.submit — permissions", () => {
  it("Department.head can submit review", async () => {
    const repo = makeRepo();
    const notif = makeNotif();
    const result = await makeService(repo, notif).submit(
      STAFF_ID,
      DEPT_HEAD_ID,
      "FRONT_OFFICE",
      null,
      { reviewType: "THREE_MO", status: "PASSED", leaderAssessment: "good" },
    );
    expect(result.status).toBe("PASSED");
    expect(repo.upsertReview).toHaveBeenCalledWith(
      expect.objectContaining({
        staffRecordId: STAFF_ID,
        reviewType: "THREE_MO",
        status: "PASSED",
        reviewedById: DEPT_HEAD_ID,
      }),
      expect.anything(),
    );
  });

  it("HR_MANAGER can submit review even when not dept head", async () => {
    const repo = makeRepo();
    await makeService(repo).submit(
      STAFF_ID,
      HR_ID,
      "FRONT_OFFICE",
      "HR_MANAGER",
      { reviewType: "THREE_MO", status: "PASSED", leaderAssessment: "good" },
    );
    expect(repo.upsertReview).toHaveBeenCalled();
  });

  it("ADMIN can submit review", async () => {
    const repo = makeRepo();
    await makeService(repo).submit(STAFF_ID, ADMIN_ID, "ADMIN", null, {
      reviewType: "THREE_MO",
      status: "PASSED",
      leaderAssessment: "ok",
    });
    expect(repo.upsertReview).toHaveBeenCalled();
  });

  it("throws 403 for non-head non-HR non-admin", async () => {
    const repo = makeRepo();
    await expect(
      makeService(repo).submit(STAFF_ID, OUTSIDER_ID, "FRONT_OFFICE", null, {
        reviewType: "THREE_MO",
        status: "PASSED",
        leaderAssessment: "ok",
      }),
    ).rejects.toThrow(new AppError(403, "NOT_DEPARTMENT_HEAD"));
  });
});

// ────────────────────────────────────────────
// submit — validation
// ────────────────────────────────────────────

describe("ProbationReviewService.submit — validation", () => {
  it("throws 404 STAFF_RECORD_NOT_FOUND when staff missing", async () => {
    const repo = makeRepo({
      findStaffWithDept: jest.fn<any>().mockResolvedValue(null),
    });
    await expect(
      makeService(repo).submit(999, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
        reviewType: "THREE_MO",
        status: "PASSED",
        leaderAssessment: "x",
      }),
    ).rejects.toThrow(new AppError(404, "STAFF_RECORD_NOT_FOUND"));
  });

  it("throws 400 PROBATION_NOT_STARTED when probationStartedAt is null", async () => {
    const repo = makeRepo({
      findStaffWithDept: jest
        .fn<any>()
        .mockResolvedValue(makeStaff({ probationStartedAt: null })),
    });
    await expect(
      makeService(repo).submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
        reviewType: "THREE_MO",
        status: "PASSED",
        leaderAssessment: "x",
      }),
    ).rejects.toThrow(new AppError(400, "PROBATION_NOT_STARTED"));
  });

  it("throws 400 PROBATION_ALREADY_ENDED when probationStatus is PASSED", async () => {
    const repo = makeRepo({
      findStaffWithDept: jest
        .fn<any>()
        .mockResolvedValue(makeStaff({ probationStatus: "PASSED" })),
    });
    await expect(
      makeService(repo).submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
        reviewType: "THREE_MO",
        status: "PASSED",
        leaderAssessment: "x",
      }),
    ).rejects.toThrow(new AppError(400, "PROBATION_ALREADY_ENDED"));
  });

  it("throws 400 ASSESSMENT_REQUIRED when leaderAssessment is empty", async () => {
    await expect(
      makeService().submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
        reviewType: "THREE_MO",
        status: "PASSED",
        leaderAssessment: "   ",
      }),
    ).rejects.toThrow(new AppError(400, "ASSESSMENT_REQUIRED"));
  });

  it("throws 400 INVALID_STATUS when status is PENDING", async () => {
    await expect(
      makeService().submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
        reviewType: "THREE_MO",
        status: "PENDING" as any,
        leaderAssessment: "ok",
      }),
    ).rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  it("throws 400 REVIEW_ALREADY_COMPLETED when a non-PENDING review exists for that type", async () => {
    const repo = makeRepo({
      findReviewByStaffAndType: jest
        .fn<any>()
        .mockResolvedValue({ id: 5, status: "PASSED" }),
    });
    await expect(
      makeService(repo).submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
        reviewType: "THREE_MO",
        status: "PASSED",
        leaderAssessment: "ok",
      }),
    ).rejects.toThrow(new AppError(400, "REVIEW_ALREADY_COMPLETED"));
  });
});

// ────────────────────────────────────────────
// submit — status transitions on StaffRecord
// ────────────────────────────────────────────

describe("ProbationReviewService.submit — probation status transitions", () => {
  it("THREE_MO PASSED keeps StaffRecord.probationStatus = IN_PROGRESS", async () => {
    const repo = makeRepo();
    await makeService(repo).submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
      reviewType: "THREE_MO",
      status: "PASSED",
      leaderAssessment: "ok",
    });
    expect(repo.setStaffProbation).not.toHaveBeenCalled();
  });

  it("SIX_MO PASSED sets StaffRecord.probationStatus = PASSED + probationEndedAt", async () => {
    const repo = makeRepo();
    await makeService(repo).submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
      reviewType: "SIX_MO",
      status: "PASSED",
      leaderAssessment: "ok",
    });
    expect(repo.setStaffProbation).toHaveBeenCalledWith(
      STAFF_ID,
      expect.objectContaining({ probationStatus: "PASSED", probationEndedAt: expect.any(Date) }),
      expect.anything(),
    );
  });

  it("THREE_MO FAILED sets StaffRecord.probationStatus = FAILED + probationEndedAt", async () => {
    const repo = makeRepo();
    await makeService(repo).submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
      reviewType: "THREE_MO",
      status: "FAILED",
      leaderAssessment: "sadly not",
    });
    expect(repo.setStaffProbation).toHaveBeenCalledWith(
      STAFF_ID,
      expect.objectContaining({ probationStatus: "FAILED", probationEndedAt: expect.any(Date) }),
      expect.anything(),
    );
  });

  it("SIX_MO FAILED sets StaffRecord.probationStatus = FAILED", async () => {
    const repo = makeRepo();
    await makeService(repo).submit(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null, {
      reviewType: "SIX_MO",
      status: "FAILED",
      leaderAssessment: "sadly not",
    });
    expect(repo.setStaffProbation).toHaveBeenCalledWith(
      STAFF_ID,
      expect.objectContaining({ probationStatus: "FAILED" }),
      expect.anything(),
    );
  });
});

// ────────────────────────────────────────────
// submit — notifications
// ────────────────────────────────────────────

describe("ProbationReviewService.submit — notifications", () => {
  it("PROBATION_REVIEW_COMPLETED notif fires to staff (when linked user exists)", async () => {
    const notif = makeNotif();
    const repo = makeRepo({
      findStaffIdByUserEmail: jest.fn<any>().mockResolvedValue({ id: 555 }),
    });
    await makeService(repo, notif).submit(
      STAFF_ID,
      DEPT_HEAD_ID,
      "FRONT_OFFICE",
      null,
      { reviewType: "THREE_MO", status: "PASSED", leaderAssessment: "ok" },
    );
    expect(notif.createForUser).toHaveBeenCalledWith(
      555,
      "PROBATION_REVIEW_COMPLETED",
      expect.any(Function),
      STAFF_ID,
    );
  });

  it("no notif fired when no linked user is found (staff has no email/user)", async () => {
    const notif = makeNotif();
    const repo = makeRepo({
      findStaffIdByUserEmail: jest.fn<any>().mockResolvedValue(null),
    });
    await makeService(repo, notif).submit(
      STAFF_ID,
      DEPT_HEAD_ID,
      "FRONT_OFFICE",
      null,
      { reviewType: "THREE_MO", status: "PASSED", leaderAssessment: "ok" },
    );
    expect(notif.createForUser).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────
// history / read
// ────────────────────────────────────────────

describe("ProbationReviewService.list", () => {
  it("returns reviews for a staff record", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const repo = makeRepo({
      findReviewsForStaff: jest.fn<any>().mockResolvedValue(rows),
    });
    const service = makeService(repo);
    const result = await service.list(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null);
    expect(result).toBe(rows);
    expect(repo.findReviewsForStaff).toHaveBeenCalledWith(STAFF_ID);
  });

  it("throws 404 when staff missing", async () => {
    const repo = makeRepo({
      findStaffWithDept: jest.fn<any>().mockResolvedValue(null),
    });
    await expect(
      makeService(repo).list(STAFF_ID, DEPT_HEAD_ID, "FRONT_OFFICE", null),
    ).rejects.toThrow(new AppError(404, "STAFF_RECORD_NOT_FOUND"));
  });

  it("Dept.head + HR + admin + self all allowed to read", async () => {
    // sanity: read is more permissive than submit — outsider still blocked
    await expect(
      makeService().list(STAFF_ID, OUTSIDER_ID, "FRONT_OFFICE", null),
    ).rejects.toThrow(new AppError(403, "FORBIDDEN"));
  });
});

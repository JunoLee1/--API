import { OnboardingTaskService } from "../../src/onboarding-task/onboarding-task.service";
import { AppError } from "../../src/lib/appError";
import type { OnboardingTaskRepository } from "../../src/onboarding-task/onboarding-task.repo";
import type { NotificationRepository } from "../../src/notification/notification.repo";
import type { PrismaClient } from "../../src/generated/client";

jest.mock("../../src/lib/auditLog", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

const TRAINEE_ID = 700;
const HR_ID = 100;
const DEPT_HEAD = 50;
const DEPT_ID = 10;
const DISPATCH_ID = 30;
const ONBOARDING_ID = 999;
const OUTSIDER = 500;

const makeTask = (overrides: Partial<any> = {}) => ({
  id: 1,
  onboardingId: ONBOARDING_ID,
  title: "환영 오리엔테이션",
  description: null,
  dueDate: null,
  requiresVerification: false,
  optional: false,
  status: "PENDING" as const,
  order: 0,
  selfReportedAt: null,
  verifiedById: null,
  verifiedAt: null,
  verifyNotes: null,
  skipReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  verifiedBy: null,
  onboarding: {
    id: ONBOARDING_ID,
    userId: TRAINEE_ID,
    hiringDispatch: {
      id: DISPATCH_ID,
      departmentId: DEPT_ID,
      department: { id: DEPT_ID, headId: DEPT_HEAD },
    },
  },
  ...overrides,
});

const makeRepo = (overrides: Partial<OnboardingTaskRepository> = {}): OnboardingTaskRepository =>
  ({
    findById: jest.fn().mockResolvedValue(null),
    findByOnboardingId: jest.fn().mockResolvedValue([]),
    findVerifyQueue: jest.fn().mockResolvedValue([]),
    updateStatus: jest.fn().mockImplementation(async (id: number, data: any) =>
      makeTask({ id, status: data.status }),
    ),
    countIncompleteRequired: jest.fn().mockResolvedValue(0),
    setContentCompletedIfNull: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as OnboardingTaskRepository);

const makeNotifRepo = (): NotificationRepository =>
  ({
    createForUser: jest.fn().mockResolvedValue(undefined),
    createForHrManager: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationRepository);

const makePrisma = (): PrismaClient => ({} as unknown as PrismaClient);

const makeService = (
  repo = makeRepo(),
  notif = makeNotifRepo(),
) => new OnboardingTaskService(repo, notif, makePrisma());

// ────────────────────────────────────────────
// selfReport
// ────────────────────────────────────────────

describe("OnboardingTaskService.selfReport", () => {
  it("PENDING → DONE when requiresVerification=false", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ requiresVerification: false })),
    });
    const result = await makeService(repo).selfReport(1, TRAINEE_ID);
    expect(result.status).toBe("DONE");
    expect(repo.updateStatus).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: "DONE", selfReportedAt: expect.any(Date) }),
    );
  });

  it("PENDING → SELF_REPORTED when requiresVerification=true", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ requiresVerification: true })),
    });
    const result = await makeService(repo, notif).selfReport(1, TRAINEE_ID);
    expect(result.status).toBe("SELF_REPORTED");
    // Verify request notif goes to HR + dept.head.
    // Fire-and-forget — flush the microtask queue so we can assert.
    await Promise.resolve();
    await Promise.resolve();
    expect(notif.createForHrManager).toHaveBeenCalledWith(
      "ONBOARDING_TASK_VERIFY_REQUESTED",
      expect.any(Function),
      DISPATCH_ID,
    );
    expect(notif.createForUser).toHaveBeenCalledWith(
      DEPT_HEAD,
      "ONBOARDING_TASK_VERIFY_REQUESTED",
      expect.any(Function),
      DISPATCH_ID,
    );
  });

  it("throws NOT_TASK_OWNER when actor is not the trainee", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask()),
    });
    await expect(makeService(repo).selfReport(1, OUTSIDER)).rejects.toThrow(
      new AppError(403, "NOT_TASK_OWNER"),
    );
  });

  it("throws INVALID_STATE_TRANSITION when task is not PENDING", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ status: "SELF_REPORTED" })),
    });
    await expect(makeService(repo).selfReport(1, TRAINEE_ID)).rejects.toThrow(
      new AppError(409, "INVALID_STATE_TRANSITION"),
    );
  });

  it("throws TASK_NOT_FOUND when task missing", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    await expect(makeService(repo).selfReport(999, TRAINEE_ID)).rejects.toThrow(
      new AppError(404, "TASK_NOT_FOUND"),
    );
  });
});

// ────────────────────────────────────────────
// verify
// ────────────────────────────────────────────

describe("OnboardingTaskService.verify", () => {
  it("SELF_REPORTED → DONE on APPROVE by dept.head", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ status: "SELF_REPORTED", requiresVerification: true })),
    });
    const result = await makeService(repo, notif).verify(
      1,
      { action: "APPROVE" },
      DEPT_HEAD,
      "FRONT_OFFICE",
      null,
    );
    expect(result.status).toBe("DONE");
    expect(repo.updateStatus).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        status: "DONE",
        verifiedById: DEPT_HEAD,
        verifiedAt: expect.any(Date),
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(notif.createForUser).toHaveBeenCalledWith(
      TRAINEE_ID,
      "ONBOARDING_TASK_VERIFIED",
      expect.any(Function),
      DISPATCH_ID,
    );
  });

  it("SELF_REPORTED → PENDING on REJECT with verifyNotes", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ status: "SELF_REPORTED", requiresVerification: true })),
    });
    const result = await makeService(repo, notif).verify(
      1,
      { action: "REJECT", verifyNotes: "다시 진행해주세요" },
      HR_ID,
      "FRONT_OFFICE",
      "HR_MANAGER",
    );
    expect(result.status).toBe("PENDING");
    expect(repo.updateStatus).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        status: "PENDING",
        verifyNotes: "다시 진행해주세요",
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(notif.createForUser).toHaveBeenCalledWith(
      TRAINEE_ID,
      "ONBOARDING_TASK_REJECTED",
      expect.any(Function),
      DISPATCH_ID,
    );
  });

  it("REJECT requires verifyNotes", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ status: "SELF_REPORTED" })),
    });
    await expect(
      makeService(repo).verify(1, { action: "REJECT" }, HR_ID, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(400, "VERIFY_NOTES_REQUIRED"));
    await expect(
      makeService(repo).verify(
        1,
        { action: "REJECT", verifyNotes: "   " },
        HR_ID,
        "FRONT_OFFICE",
        "HR_MANAGER",
      ),
    ).rejects.toThrow(new AppError(400, "VERIFY_NOTES_REQUIRED"));
  });

  it("blocks self-verify — trainee cannot approve own task (403 CANNOT_SELF_VERIFY)", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ status: "SELF_REPORTED" })),
    });
    await expect(
      makeService(repo).verify(1, { action: "APPROVE" }, TRAINEE_ID, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(403, "CANNOT_SELF_VERIFY"));
  });

  it("throws NOT_VERIFIER when actor is neither HR nor dept.head", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ status: "SELF_REPORTED" })),
    });
    await expect(
      makeService(repo).verify(1, { action: "APPROVE" }, OUTSIDER, "PLAYER", null),
    ).rejects.toThrow(new AppError(403, "NOT_VERIFIER"));
  });

  it("throws INVALID_STATE_TRANSITION when task is not SELF_REPORTED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ status: "PENDING" })),
    });
    await expect(
      makeService(repo).verify(1, { action: "APPROVE" }, HR_ID, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(409, "INVALID_STATE_TRANSITION"));
  });

  it("throws INVALID_VERIFY_ACTION for unknown action", async () => {
    await expect(
      makeService().verify(
        1,
        { action: "MAYBE" as any },
        HR_ID,
        "FRONT_OFFICE",
        "HR_MANAGER",
      ),
    ).rejects.toThrow(new AppError(400, "INVALID_VERIFY_ACTION"));
  });
});

// ────────────────────────────────────────────
// skip
// ────────────────────────────────────────────

describe("OnboardingTaskService.skip", () => {
  it("PENDING (optional) → SKIPPED when owner skips", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ optional: true, status: "PENDING" })),
    });
    const result = await makeService(repo).skip(
      1,
      { skipReason: "해당 사항 없음" },
      TRAINEE_ID,
      "FRONT_OFFICE",
      null,
    );
    expect(result.status).toBe("SKIPPED");
    expect(repo.updateStatus).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: "SKIPPED", skipReason: "해당 사항 없음" }),
    );
  });

  it("HR can skip on trainee's behalf", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ optional: true, status: "PENDING" })),
    });
    const result = await makeService(repo).skip(
      1,
      { skipReason: "waiver" },
      HR_ID,
      "FRONT_OFFICE",
      "HR_MANAGER",
    );
    expect(result.status).toBe("SKIPPED");
  });

  it("dept.head can skip on trainee's behalf", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ optional: true, status: "PENDING" })),
    });
    const result = await makeService(repo).skip(
      1,
      { skipReason: "waiver" },
      DEPT_HEAD,
      "FRONT_OFFICE",
      null,
    );
    expect(result.status).toBe("SKIPPED");
  });

  it("throws TASK_NOT_OPTIONAL when task is not optional", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ optional: false })),
    });
    await expect(
      makeService(repo).skip(1, { skipReason: "x" }, TRAINEE_ID, "FRONT_OFFICE", null),
    ).rejects.toThrow(new AppError(400, "TASK_NOT_OPTIONAL"));
  });

  it("throws ALREADY_TERMINAL when task is DONE", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ optional: true, status: "DONE" })),
    });
    await expect(
      makeService(repo).skip(1, { skipReason: "x" }, TRAINEE_ID, "FRONT_OFFICE", null),
    ).rejects.toThrow(new AppError(409, "ALREADY_TERMINAL"));
  });

  it("throws SKIP_REASON_REQUIRED when reason empty", async () => {
    await expect(
      makeService().skip(1, { skipReason: "   " }, TRAINEE_ID, "FRONT_OFFICE", null),
    ).rejects.toThrow(new AppError(400, "SKIP_REASON_REQUIRED"));
  });

  it("throws NOT_AUTHORIZED when actor is neither owner, HR, nor dept.head", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeTask({ optional: true })),
    });
    await expect(
      makeService(repo).skip(1, { skipReason: "x" }, OUTSIDER, "PLAYER", null),
    ).rejects.toThrow(new AppError(403, "NOT_AUTHORIZED"));
  });
});

// ────────────────────────────────────────────
// checkContentCompletion
// ────────────────────────────────────────────

describe("OnboardingTaskService.checkContentCompletion", () => {
  it("sets contentCompletedAt when all required tasks are terminal", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      countIncompleteRequired: jest.fn().mockResolvedValue(0),
      setContentCompletedIfNull: jest.fn().mockResolvedValue({
        id: ONBOARDING_ID,
        userId: TRAINEE_ID,
        contentCompletedAt: new Date(),
        hiringDispatch: {
          id: DISPATCH_ID,
          department: { headId: DEPT_HEAD },
        },
      }),
    });
    await makeService(repo, notif).checkContentCompletion(ONBOARDING_ID);
    expect(repo.setContentCompletedIfNull).toHaveBeenCalledWith(ONBOARDING_ID);
    // Trainee + HR + dept.head each receive a completion notif.
    await Promise.resolve();
    await Promise.resolve();
    expect(notif.createForUser).toHaveBeenCalledWith(
      TRAINEE_ID,
      "ONBOARDING_CONTENT_COMPLETED",
      expect.any(Function),
      DISPATCH_ID,
    );
    expect(notif.createForUser).toHaveBeenCalledWith(
      DEPT_HEAD,
      "ONBOARDING_CONTENT_COMPLETED",
      expect.any(Function),
      DISPATCH_ID,
    );
    expect(notif.createForHrManager).toHaveBeenCalledWith(
      "ONBOARDING_CONTENT_COMPLETED",
      expect.any(Function),
      DISPATCH_ID,
    );
  });

  it("no-op when incompletes remain", async () => {
    const repo = makeRepo({
      countIncompleteRequired: jest.fn().mockResolvedValue(2),
    });
    await makeService(repo).checkContentCompletion(ONBOARDING_ID);
    expect(repo.setContentCompletedIfNull).not.toHaveBeenCalled();
  });

  it("no-op when contentCompletedAt already set (race)", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      countIncompleteRequired: jest.fn().mockResolvedValue(0),
      setContentCompletedIfNull: jest.fn().mockResolvedValue(null),
    });
    await makeService(repo, notif).checkContentCompletion(ONBOARDING_ID);
    expect(notif.createForUser).not.toHaveBeenCalled();
    expect(notif.createForHrManager).not.toHaveBeenCalled();
  });
});

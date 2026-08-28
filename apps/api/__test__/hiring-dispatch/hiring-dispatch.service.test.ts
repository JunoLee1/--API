import { HiringDispatchService } from "../../src/hiring-dispatch/hiring-dispatch.service";
import { AppError } from "../../src/lib/appError";
import type { HiringDispatchRepository } from "../../src/hiring-dispatch/hiring-dispatch.repo";
import type { NotificationRepository } from "../../src/notification/notification.repo";
import type { PrismaClient } from "../../src/generated/client";
import type { CreateHiringDispatchDto } from "../../src/hiring-dispatch/dto/hiring-dispatch.dto";

jest.mock("../../src/lib/auditLog", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/lib/crypto", () => ({
  encrypt: jest.fn(() => ({ encrypted: "enc", iv: "iv" })),
}));
jest.mock("../../src/lib/hash", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed"),
}));

const HR_ID = 100;
// Second HR user so the "execute the dispatch" reviewer isn't the requester
// (self-approval is blocked at every stage — Q4). Different real user, same role.
const HR_EXECUTOR = 101;
const FINANCE_ID = 200;
const EXEC_ID = 300;
const OUTSIDER = 999;
const DEPT_ID = 10;
const DEPT_HEAD = 50;
const APPLICATION_ID = 555;
const HIRING_PLAN_HEADCOUNT = 3;
const NEW_USER_ID = 700;
const PHONE_ID = 800;

// A canonical dispatch row shaped for `findById`'s detailInclude.
const makeDispatch = (overrides: Partial<any> = {}) => ({
  id: 1,
  applicationId: APPLICATION_ID,
  candidateName: "홍길동",
  candidateEmail: "hong@example.com",
  jobTitle: "Software Engineer",
  jobGrade: "ASSOCIATE" as const,
  employmentType: "FULL_TIME" as const,
  departmentId: DEPT_ID,
  reportsToUserId: null,
  monthlySalary: 5_000_000n,
  startDate: new Date("2026-09-01"),
  targetRole: "FRONT_OFFICE",
  targetFrontOfficeRole: null,
  targetCoachingRole: null,
  permissionNotes: null,
  status: "CREATED" as const,
  createdUserId: null,
  createdById: HR_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  application: {
    id: APPLICATION_ID,
    applicantName: "홍길동",
    email: "hong@example.com",
    status: "OFFERED",
    postingId: 40,
    posting: {
      id: 40,
      title: "SW Engineer",
      headcount: 5,
      hiringPlanItemId: 88,
      hiringPlanItem: {
        id: 88,
        roleTitle: "SW Engineer",
        headcount: HIRING_PLAN_HEADCOUNT,
      },
    },
  },
  department: {
    id: DEPT_ID,
    name: "개발팀",
    headId: DEPT_HEAD,
    parentId: null,
    parent: null,
  },
  createdBy: { id: HR_ID, username: "hr", nickname: "HR" },
  createdUser: null,
  reportsToUser: null,
  approvals: [],
  onboarding: null,
  ...overrides,
});

const makeRepo = (overrides: Partial<HiringDispatchRepository> = {}): HiringDispatchRepository =>
  ({
    create: jest.fn().mockImplementation(async (dto, createdById) =>
      makeDispatch({
        candidateName: dto.candidateName,
        candidateEmail: dto.candidateEmail,
        createdById,
        applicationId: dto.applicationId ?? null,
      }),
    ),
    findById: jest.fn().mockResolvedValue(null),
    findByCreator: jest.fn().mockResolvedValue([]),
    findByDepartment: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
    findPendingForBudget: jest.fn().mockResolvedValue([]),
    findPendingForDispatch: jest.fn().mockResolvedValue([]),
    findPendingForExecution: jest.fn().mockResolvedValue([]),
    updateStatus: jest.fn().mockImplementation(async (id, patch) =>
      makeDispatch({ id, status: patch.status, createdUserId: patch.createdUserId ?? null }),
    ),
    addApproval: jest.fn().mockResolvedValue({}),
    countDeptMembers: jest.fn().mockResolvedValue(0),
    findUserByEmail: jest.fn().mockResolvedValue(null),
    createPhoneNumber: jest.fn().mockResolvedValue({ id: PHONE_ID }),
    createUser: jest.fn().mockResolvedValue({
      id: NEW_USER_ID,
      email: "hong@example.com",
      username: "홍길동",
      nickname: "홍길동#1",
      role: "FRONT_OFFICE",
    }),
    createUserDepartment: jest.fn().mockResolvedValue({}),
    createStaffRecord: jest.fn().mockResolvedValue({ id: 900 }),
    createOnboarding: jest.fn().mockResolvedValue({ id: 999 }),
    ...overrides,
  } as unknown as HiringDispatchRepository);

const makeNotifRepo = (): NotificationRepository =>
  ({
    createForUser: jest.fn().mockResolvedValue(undefined),
    createForHrManager: jest.fn().mockResolvedValue(undefined),
    createForFinanceManager: jest.fn().mockResolvedValue(undefined),
    createForGM: jest.fn().mockResolvedValue(undefined),
    // #373 provisioning shortage alert — default no-op; specific tests spy.
    createForAssetManager: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationRepository);

// Default in-tx stubs. `populateOnboardingTasks()` reads
// `tx.onboardingTemplate.findUnique` and (when populate is needed)
// `tx.onboardingTask.createMany`. Returning `null` = department has no
// template, so populate is a no-op — matches "no template" backward-compat.
const makeTxStub = (overrides: Partial<any> = {}) => ({
  onboardingTemplate: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
  onboardingTask: {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  ...overrides,
});

const makePrisma = (overrides: Partial<any> = {}, txStub: any = makeTxStub()): PrismaClient =>
  ({
    jobApplication: {
      findUnique: jest.fn().mockResolvedValue({ id: APPLICATION_ID, status: "OFFERED" }),
    },
    // Fire-and-forget notifyNewEmployeeTasksAssigned reads onboarding + task count.
    onboarding: {
      findFirst: jest.fn().mockResolvedValue({ id: 999, _count: { tasks: 0 } }),
    },
    // Fire-and-forget provisionNewEmployeeAssets (#373) reads dispatch (again,
    // post-tx) + department kit + equipment stock. Default: dispatch resolves,
    // no kit → helper is a silent no-op. Test cases override selectively.
    hiringDispatch: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        candidateName: "홍길동",
        departmentId: DEPT_ID,
        createdUserId: NEW_USER_ID,
      }),
    },
    departmentDefaultAssetKit: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    equipmentItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    equipmentUnit: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    assetRequest: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    // Passthrough tx — mocked repos ignore the tx arg but populate helper uses it.
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(txStub)),
    ...overrides,
  } as unknown as PrismaClient);

const makeService = (
  repo = makeRepo(),
  notif = makeNotifRepo(),
  prisma = makePrisma(),
) => new HiringDispatchService(repo, notif, prisma);

const baseCreateDto: CreateHiringDispatchDto = {
  applicationId: APPLICATION_ID,
  candidateName: "홍길동",
  candidateEmail: "hong@example.com",
  jobTitle: "Software Engineer",
  jobGrade: "ASSOCIATE",
  employmentType: "FULL_TIME",
  departmentId: DEPT_ID,
  monthlySalary: 5_000_000,
  startDate: "2026-09-01",
  targetRole: "FRONT_OFFICE",
};

// ────────────────────────────────────────────
// create
// ────────────────────────────────────────────

describe("HiringDispatchService.create", () => {
  it("creates dispatch from an OFFERED Application", async () => {
    const repo = makeRepo();
    const result = await makeService(repo).create(baseCreateDto, HR_ID, "FRONT_OFFICE", "HR_MANAGER");
    expect(result.status).toBe("CREATED");
    expect(repo.create).toHaveBeenCalledWith(baseCreateDto, HR_ID);
  });

  it("creates Application-free dispatch when caller is HR_MANAGER", async () => {
    const repo = makeRepo();
    const dto: CreateHiringDispatchDto = { ...baseCreateDto };
    delete (dto as any).applicationId;
    const result = await makeService(repo).create(dto, HR_ID, "FRONT_OFFICE", "HR_MANAGER");
    expect(result.status).toBe("CREATED");
    expect(repo.create).toHaveBeenCalled();
  });

  it("creates Application-free dispatch when caller is ADMIN", async () => {
    const repo = makeRepo();
    const dto: CreateHiringDispatchDto = { ...baseCreateDto };
    delete (dto as any).applicationId;
    const result = await makeService(repo).create(dto, EXEC_ID, "ADMIN", null);
    expect(result.status).toBe("CREATED");
  });

  it("throws 400 APPLICATION_NOT_OFFERED when application status is not OFFERED", async () => {
    const prisma = makePrisma({
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: APPLICATION_ID, status: "APPLIED" }),
      },
    });
    await expect(
      makeService(makeRepo(), makeNotifRepo(), prisma).create(
        baseCreateDto,
        HR_ID,
        "FRONT_OFFICE",
        "HR_MANAGER",
      ),
    ).rejects.toThrow(new AppError(400, "APPLICATION_NOT_OFFERED"));
  });

  it("throws 400 APPLICATION_NOT_FOUND when application is missing", async () => {
    const prisma = makePrisma({
      jobApplication: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      makeService(makeRepo(), makeNotifRepo(), prisma).create(
        baseCreateDto,
        HR_ID,
        "FRONT_OFFICE",
        "HR_MANAGER",
      ),
    ).rejects.toThrow(new AppError(400, "APPLICATION_NOT_FOUND"));
  });

  it("throws 403 HR_ONLY_FOR_FREE_FORM when non-HR opens Application-free dispatch", async () => {
    const dto: CreateHiringDispatchDto = { ...baseCreateDto };
    delete (dto as any).applicationId;
    await expect(
      makeService().create(dto, OUTSIDER, "COACHING_STAFF", null),
    ).rejects.toThrow(new AppError(403, "HR_ONLY_FOR_FREE_FORM"));
  });

  it("throws 400 MISSING_REQUIRED_FIELD when jobTitle is blank", async () => {
    const dto: CreateHiringDispatchDto = { ...baseCreateDto, jobTitle: "" };
    await expect(
      makeService().create(dto, HR_ID, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(400, "MISSING_REQUIRED_FIELD"));
  });

  it("throws 400 INVALID_SALARY on negative monthlySalary", async () => {
    const dto: CreateHiringDispatchDto = { ...baseCreateDto, monthlySalary: -1 };
    await expect(
      makeService().create(dto, HR_ID, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(400, "INVALID_SALARY"));
  });
});

// ────────────────────────────────────────────
// budgetReverify
// ────────────────────────────────────────────

describe("HiringDispatchService.budgetReverify", () => {
  it("CREATED → BUDGET_REVERIFIED for FINANCE_MANAGER (TO within limit)", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED" })),
      countDeptMembers: jest.fn().mockResolvedValue(1), // 1 + 1 < 3
    });
    const result = await makeService(repo, notif).budgetReverify(
      1,
      FINANCE_ID,
      "FRONT_OFFICE",
      "FINANCE_MANAGER",
      {},
    );
    expect(result.status).toBe("BUDGET_REVERIFIED");
    expect(repo.addApproval).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ stage: "BUDGET_REVIEW", action: "APPROVED", reviewerId: FINANCE_ID }),
      expect.anything(),
    );
    expect(notif.createForGM).toHaveBeenCalled();
  });

  it("throws 400 TO_EXCEEDED when member+1 > headcount and no override", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED" })),
      countDeptMembers: jest.fn().mockResolvedValue(HIRING_PLAN_HEADCOUNT), // 3 + 1 > 3
    });
    await expect(
      makeService(repo).budgetReverify(1, FINANCE_ID, "FRONT_OFFICE", "FINANCE_MANAGER", {}),
    ).rejects.toThrow(new AppError(400, "TO_EXCEEDED"));
  });

  it("succeeds when TO exceeded but toOverride is true", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED" })),
      countDeptMembers: jest.fn().mockResolvedValue(HIRING_PLAN_HEADCOUNT),
    });
    const result = await makeService(repo).budgetReverify(
      1,
      FINANCE_ID,
      "FRONT_OFFICE",
      "FINANCE_MANAGER",
      { toOverride: true },
    );
    expect(result.status).toBe("BUDGET_REVERIFIED");
    // Override flag must be preserved in the approval reason JSON.
    expect(repo.addApproval).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ reason: expect.stringContaining("toOverride") }),
      expect.anything(),
    );
  });

  it("skips TO check for Application-free dispatch (no HiringPlanItem)", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(
        makeDispatch({
          status: "CREATED",
          applicationId: null,
          application: null,
        }),
      ),
      // Would trip TO_EXCEEDED if applicationId were present:
      countDeptMembers: jest.fn().mockResolvedValue(HIRING_PLAN_HEADCOUNT),
    });
    const result = await makeService(repo).budgetReverify(
      1,
      FINANCE_ID,
      "FRONT_OFFICE",
      "FINANCE_MANAGER",
      {},
    );
    expect(result.status).toBe("BUDGET_REVERIFIED");
    expect(repo.countDeptMembers).not.toHaveBeenCalled();
  });

  it("throws 400 INVALID_STATUS when not CREATED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "BUDGET_REVERIFIED" })),
    });
    await expect(
      makeService(repo).budgetReverify(1, FINANCE_ID, "FRONT_OFFICE", "FINANCE_MANAGER", {}),
    ).rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  it("throws 403 NOT_FINANCE_MANAGER for non-finance reviewer", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED" })),
    });
    await expect(
      makeService(repo).budgetReverify(1, OUTSIDER, "PLAYER", null, {}),
    ).rejects.toThrow(new AppError(403, "NOT_FINANCE_MANAGER"));
  });

  it("throws 403 SELF_APPROVAL_FORBIDDEN when reviewer is the creator", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED", createdById: FINANCE_ID })),
    });
    await expect(
      makeService(repo).budgetReverify(1, FINANCE_ID, "FRONT_OFFICE", "FINANCE_MANAGER", {}),
    ).rejects.toThrow(new AppError(403, "SELF_APPROVAL_FORBIDDEN"));
  });
});

// ────────────────────────────────────────────
// budgetReject
// ────────────────────────────────────────────

describe("HiringDispatchService.budgetReject", () => {
  it("CREATED → REJECTED with reason", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED" })),
    });
    const result = await makeService(repo, notif).budgetReject(
      1,
      FINANCE_ID,
      "FRONT_OFFICE",
      "FINANCE_MANAGER",
      "예산 부족",
    );
    expect(result.status).toBe("REJECTED");
    expect(repo.addApproval).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ stage: "BUDGET_REVIEW", action: "REJECTED", reason: "예산 부족" }),
      expect.anything(),
    );
    expect(notif.createForUser).toHaveBeenCalledWith(
      HR_ID,
      expect.any(String),
      expect.any(Function),
      1,
    );
  });

  it("throws 400 REASON_REQUIRED when reason is blank", async () => {
    await expect(
      makeService().budgetReject(1, FINANCE_ID, "FRONT_OFFICE", "FINANCE_MANAGER", "  "),
    ).rejects.toThrow(new AppError(400, "REASON_REQUIRED"));
  });

  it("throws 400 INVALID_STATUS when not CREATED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "BUDGET_REVERIFIED" })),
    });
    await expect(
      makeService(repo).budgetReject(1, FINANCE_ID, "FRONT_OFFICE", "FINANCE_MANAGER", "reason"),
    ).rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });
});

// ────────────────────────────────────────────
// dispatchApprove
// ────────────────────────────────────────────

describe("HiringDispatchService.dispatchApprove", () => {
  it("BUDGET_REVERIFIED → DISPATCH_APPROVED for ADMIN", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "BUDGET_REVERIFIED" })),
    });
    const result = await makeService(repo, notif).dispatchApprove(1, EXEC_ID, "ADMIN");
    expect(result.status).toBe("DISPATCH_APPROVED");
    expect(repo.addApproval).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ stage: "DISPATCH_APPROVAL", action: "APPROVED" }),
      expect.anything(),
    );
    expect(notif.createForHrManager).toHaveBeenCalled();
  });

  it("throws 403 NOT_EXECUTIVE for FRONT_OFFICE role", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "BUDGET_REVERIFIED" })),
    });
    await expect(
      makeService(repo).dispatchApprove(1, OUTSIDER, "FRONT_OFFICE"),
    ).rejects.toThrow(new AppError(403, "NOT_EXECUTIVE"));
  });

  it("throws 403 SELF_APPROVAL_FORBIDDEN when executive is the creator", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "BUDGET_REVERIFIED", createdById: EXEC_ID })),
    });
    await expect(
      makeService(repo).dispatchApprove(1, EXEC_ID, "ADMIN"),
    ).rejects.toThrow(new AppError(403, "SELF_APPROVAL_FORBIDDEN"));
  });

  it("throws 400 INVALID_STATUS when not BUDGET_REVERIFIED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED" })),
    });
    await expect(
      makeService(repo).dispatchApprove(1, EXEC_ID, "ADMIN"),
    ).rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });
});

// ────────────────────────────────────────────
// dispatchReject
// ────────────────────────────────────────────

describe("HiringDispatchService.dispatchReject", () => {
  it("BUDGET_REVERIFIED → REJECTED with reason", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "BUDGET_REVERIFIED" })),
    });
    const result = await makeService(repo).dispatchReject(1, EXEC_ID, "ADMIN", "예산 재검토");
    expect(result.status).toBe("REJECTED");
  });

  it("throws 400 REASON_REQUIRED when reason is blank", async () => {
    await expect(
      makeService().dispatchReject(1, EXEC_ID, "ADMIN", ""),
    ).rejects.toThrow(new AppError(400, "REASON_REQUIRED"));
  });
});

// ────────────────────────────────────────────
// dispatch (HR execution — the $transaction)
// ────────────────────────────────────────────

describe("HiringDispatchService.dispatch", () => {
  it("DISPATCH_APPROVED → ONBOARDING; creates User + UserDept + StaffRecord + Onboarding", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    const result = await makeService(repo, notif).dispatch(
      1,
      HR_EXECUTOR,
      "FRONT_OFFICE",
      "HR_MANAGER",
    );
    expect(result.status).toBe("ONBOARDING");
    expect(result.createdUserId).toBe(NEW_USER_ID);
    // All five provisioning writes must happen inside the tx.
    expect(repo.createPhoneNumber).toHaveBeenCalled();
    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "hong@example.com",
        role: "FRONT_OFFICE",
        phoneNumberId: PHONE_ID,
      }),
      expect.anything(),
    );
    expect(repo.createUserDepartment).toHaveBeenCalledWith(
      { userId: NEW_USER_ID, departmentId: DEPT_ID },
      expect.anything(),
    );
    expect(repo.createStaffRecord).toHaveBeenCalledWith(
      expect.objectContaining({ email: "hong@example.com", departmentId: DEPT_ID }),
      expect.anything(),
    );
    expect(repo.createOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ hiringDispatchId: 1, userId: NEW_USER_ID }),
      expect.anything(),
    );
    expect(repo.addApproval).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ stage: "EXECUTION", action: "APPROVED", reviewerId: HR_EXECUTOR }),
      expect.anything(),
    );
    // Team lead notif + candidate OTP notif (permissionNotes is null so no HR notif).
    expect(notif.createForUser).toHaveBeenCalledWith(
      DEPT_HEAD,
      expect.any(String),
      expect.any(Function),
      1,
    );
    expect(notif.createForUser).toHaveBeenCalledWith(
      NEW_USER_ID,
      expect.any(String),
      expect.any(Function),
      1,
    );
  });

  it("notifies HR when permissionNotes are set", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(
        makeDispatch({ status: "DISPATCH_APPROVED", permissionNotes: "GA admin 권한 필요" }),
      ),
    });
    await makeService(repo, notif).dispatch(1, HR_EXECUTOR, "FRONT_OFFICE", "HR_MANAGER");
    expect(notif.createForHrManager).toHaveBeenCalled();
  });

  it("createStaffRecord seeds probationStartedAt + probationStatus=IN_PROGRESS (issue #375)", async () => {
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    await makeService(repo, notif).dispatch(1, HR_EXECUTOR, "FRONT_OFFICE", "HR_MANAGER");
    expect(repo.createStaffRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "hong@example.com",
        departmentId: DEPT_ID,
        probationStartedAt: expect.any(Date),
        probationStatus: "IN_PROGRESS",
      }),
      expect.anything(),
    );
  });

  it("throws 400 EMAIL_ALREADY_IN_USE before opening the tx", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
      findUserByEmail: jest.fn().mockResolvedValue({ id: 42 }),
    });
    await expect(
      makeService(repo).dispatch(1, HR_EXECUTOR, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(400, "EMAIL_ALREADY_IN_USE"));
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it("throws 403 NOT_HR_MANAGER for non-HR reviewer", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    await expect(
      makeService(repo).dispatch(1, OUTSIDER, "PLAYER", null),
    ).rejects.toThrow(new AppError(403, "NOT_HR_MANAGER"));
  });

  it("throws 403 SELF_APPROVAL_FORBIDDEN when HR is the creator", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(
        makeDispatch({ status: "DISPATCH_APPROVED", createdById: HR_ID }),
      ),
    });
    await expect(
      makeService(repo).dispatch(1, HR_ID, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(403, "SELF_APPROVAL_FORBIDDEN"));
  });

  it("throws 400 INVALID_STATUS when not DISPATCH_APPROVED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "BUDGET_REVERIFIED" })),
    });
    await expect(
      makeService(repo).dispatch(1, HR_ID, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  // ────────────────────────────────────────────
  // #374 — OnboardingTask populate (inside dispatch tx)
  // ────────────────────────────────────────────

  it("populates OnboardingTask rows from department template inside the dispatch tx (#374)", async () => {
    const templateTasks = [
      { title: "환영 오리엔테이션" },
      { title: "장비 수령", dueDaysFromStart: 3, requiresVerification: true },
    ];
    const txStub = makeTxStub({
      onboardingTemplate: {
        findUnique: jest.fn().mockResolvedValue({ tasks: templateTasks }),
      },
      onboardingTask: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    });
    const prisma = makePrisma(
      {
        onboarding: {
          findFirst: jest.fn().mockResolvedValue({ id: 999, _count: { tasks: 2 } }),
        },
      },
      txStub,
    );
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    await makeService(repo, notif, prisma).dispatch(
      1,
      HR_EXECUTOR,
      "FRONT_OFFICE",
      "HR_MANAGER",
    );
    // Template lookup happened inside the tx with the dispatch's departmentId.
    expect(txStub.onboardingTemplate.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { departmentId: DEPT_ID } }),
    );
    // Two tasks were populated (order = template array index).
    expect(txStub.onboardingTask.createMany).toHaveBeenCalledTimes(1);
    const createArg = (txStub.onboardingTask.createMany as jest.Mock).mock.calls[0][0];
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data[0]).toEqual(expect.objectContaining({ title: "환영 오리엔테이션", order: 0 }));
    expect(createArg.data[1]).toEqual(
      expect.objectContaining({ title: "장비 수령", requiresVerification: true, order: 1 }),
    );
    // Fire-and-forget ONBOARDING_TASKS_ASSIGNED notif reaches trainee (count > 0).
    await Promise.resolve();
    await Promise.resolve();
    expect(notif.createForUser).toHaveBeenCalledWith(
      NEW_USER_ID,
      "ONBOARDING_TASKS_ASSIGNED",
      expect.any(Function),
      1,
    );
  });

  it("dispatch still succeeds when department has no template (backward-compat)", async () => {
    // Default txStub returns null for template lookup — the pre-#374 path.
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    const result = await makeService(repo, notif).dispatch(
      1,
      HR_EXECUTOR,
      "FRONT_OFFICE",
      "HR_MANAGER",
    );
    expect(result.status).toBe("ONBOARDING");
    // No ONBOARDING_TASKS_ASSIGNED notif fires when task count is 0.
    await Promise.resolve();
    await Promise.resolve();
    const tasksAssignedCall = (notif.createForUser as jest.Mock).mock.calls.find(
      (c) => c[1] === "ONBOARDING_TASKS_ASSIGNED",
    );
    expect(tasksAssignedCall).toBeUndefined();
  });

  // ────────────────────────────────────────────
  // #373 — auto-provisioning hook (fire-and-forget, post-dispatch tx)
  // ────────────────────────────────────────────

  it("fires provisionNewEmployeeAssets hook after dispatch commits (#373)", async () => {
    // Kit is populated → hook creates AssetRequest DRAFTs. Default equipment
    // stock is empty → shortage alert is fired for both items.
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    const prisma = makePrisma({
      departmentDefaultAssetKit: {
        findUnique: jest.fn().mockResolvedValue({
          assetItems: [
            { equipmentItemId: 1, quantity: 1 },
            { equipmentItemId: 2, quantity: 1 },
          ],
          defaultExpenseCategoryId: 55,
        }),
      },
      equipmentItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, name: "노트북", quantity: 0, trackedIndividually: false },
          { id: 2, name: "사원증", quantity: 5, trackedIndividually: false },
        ]),
      },
    });
    const result = await makeService(repo, notif, prisma).dispatch(
      1,
      HR_EXECUTOR,
      "FRONT_OFFICE",
      "HR_MANAGER",
    );
    expect(result.status).toBe("ONBOARDING");
    // Yield until the fire-and-forget hook resolves. `setImmediate` runs
    // after every microtask queue drain — enough to cover the chained awaits
    // inside `provisionNewEmployeeAssets` (dispatch → kit → equipment →
    // createMany loop → notify).
    await new Promise((r) => setImmediate(r));
    // 2 drafts created — one per kit item.
    const createCalls = (prisma.assetRequest.create as jest.Mock).mock.calls;
    expect(createCalls).toHaveLength(2);
    expect(createCalls[0][0].data).toEqual(
      expect.objectContaining({
        status: "DRAFT",
        isAutoProvisioned: true,
        provisionedFromDispatchId: 1,
        requesterId: NEW_USER_ID,
      }),
    );
    // ASSET_MANAGER shortage alert fired (노트북 stock=0 < request=1).
    expect(notif.createForAssetManager).toHaveBeenCalledWith(
      "PROVISIONING_LOW_STOCK",
      expect.any(Function),
      1,
    );
  });

  it("provisioning failure does not roll back dispatch (fire-and-forget, #373)", async () => {
    // Simulate a Prisma error during draft creation. The dispatch itself
    // must still resolve to ONBOARDING (already committed inside the tx).
    const notif = makeNotifRepo();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    const prisma = makePrisma({
      departmentDefaultAssetKit: {
        findUnique: jest.fn().mockResolvedValue({
          assetItems: [{ equipmentItemId: 1, quantity: 1 }],
          defaultExpenseCategoryId: 55,
        }),
      },
      equipmentItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, name: "노트북", quantity: 10, trackedIndividually: false },
        ]),
      },
      assetRequest: {
        create: jest.fn().mockRejectedValue(new Error("prisma boom")),
      },
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await makeService(repo, notif, prisma).dispatch(
      1,
      HR_EXECUTOR,
      "FRONT_OFFICE",
      "HR_MANAGER",
    );
    // Dispatch itself succeeded even though provisioning threw.
    expect(result.status).toBe("ONBOARDING");
    await new Promise((r) => setImmediate(r));
    // Error was swallowed into console.error, not rethrown.
    expect(spy).toHaveBeenCalledWith(
      "[provisionNewEmployeeAssets] failed",
      expect.any(Error),
    );
    spy.mockRestore();
  });
});

// ────────────────────────────────────────────
// cancel
// ────────────────────────────────────────────

describe("HiringDispatchService.cancel", () => {
  it("cancels a CREATED dispatch", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED" })),
    });
    const result = await makeService(repo).cancel(
      1,
      HR_ID,
      "FRONT_OFFICE",
      "HR_MANAGER",
      "CANDIDATE_WITHDREW",
    );
    expect(result.status).toBe("CANCELLED");
  });

  it("cancels a BUDGET_REVERIFIED dispatch", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "BUDGET_REVERIFIED" })),
    });
    const result = await makeService(repo).cancel(
      1,
      HR_ID,
      "FRONT_OFFICE",
      "HR_MANAGER",
      "OTHER",
    );
    expect(result.status).toBe("CANCELLED");
  });

  it("throws 400 INVALID_STATUS when DISPATCH_APPROVED", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    await expect(
      makeService(repo).cancel(1, HR_ID, "FRONT_OFFICE", "HR_MANAGER", "OTHER"),
    ).rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  it("throws 403 NOT_HR_MANAGER for non-HR caller", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "CREATED" })),
    });
    await expect(
      makeService(repo).cancel(1, OUTSIDER, "PLAYER", null, "OTHER"),
    ).rejects.toThrow(new AppError(403, "NOT_HR_MANAGER"));
  });

  it("throws 400 REASON_REQUIRED when reason blank", async () => {
    await expect(
      makeService().cancel(1, HR_ID, "FRONT_OFFICE", "HR_MANAGER", "  "),
    ).rejects.toThrow(new AppError(400, "REASON_REQUIRED"));
  });
});

// ────────────────────────────────────────────
// complete
// ────────────────────────────────────────────

describe("HiringDispatchService.complete", () => {
  it("ONBOARDING → COMPLETED for HR_MANAGER", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "ONBOARDING" })),
    });
    const result = await makeService(repo).complete(1, HR_ID, "FRONT_OFFICE", "HR_MANAGER");
    expect(result.status).toBe("COMPLETED");
  });

  it("throws 400 INVALID_STATUS when not ONBOARDING", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "DISPATCH_APPROVED" })),
    });
    await expect(
      makeService(repo).complete(1, HR_ID, "FRONT_OFFICE", "HR_MANAGER"),
    ).rejects.toThrow(new AppError(400, "INVALID_STATUS"));
  });

  it("throws 403 NOT_HR_MANAGER for non-HR caller", async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeDispatch({ status: "ONBOARDING" })),
    });
    await expect(
      makeService(repo).complete(1, OUTSIDER, "PLAYER", null),
    ).rejects.toThrow(new AppError(403, "NOT_HR_MANAGER"));
  });
});

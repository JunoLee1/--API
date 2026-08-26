import bcrypt from "bcrypt";
import { RecruitmentService } from "./recruitment.service";
import type { RecruitmentRepository } from "./recruitment.repo";

// Shared mock functions so tests can access + reset them between runs.
const mockHiringPlanItem = {
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock("../lib/prisma", () => ({
  getPrisma: () => ({
    staffRecord: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    referenceCheck: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    hiringPlanItem: mockHiringPlanItem,
    // Passthrough tx — inner callback receives the same prisma-like object.
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
      hiringPlanItem: mockHiringPlanItem,
    })),
  }),
}));

const fakeApp = {
  id: 1, status: "OFFERED", applicantName: "테스트", posting: null,
  applicationDate: new Date(), updatedAt: new Date(),
};

const makeRepo = (overrides: Partial<RecruitmentRepository> = {}): RecruitmentRepository =>
  ({
    findApplicationById: jest.fn().mockResolvedValue(fakeApp),
    findOnboardingByApplication: jest.fn().mockResolvedValue(null),
    createOnboarding: jest.fn().mockImplementation((_appId, _userId, otpCode, expiresAt) =>
      Promise.resolve({ id: 1, applicationId: 1, userId: 1, otpCode, expiresAt, emailVerifiedAt: null, mfaRegisteredAt: null })
    ),
    markEmailVerified: jest.fn().mockResolvedValue({ id: 1, emailVerifiedAt: new Date() }),
    findApplicationsByStage: jest.fn().mockResolvedValue([]),
    findApplicationsByStatus: jest.fn().mockResolvedValue([]),
    createApplication: jest.fn(),
    updateApplicationStatus: jest.fn(),
    findPostings: jest.fn().mockResolvedValue([]),
    findPostingById: jest.fn().mockResolvedValue(null),
    createPosting: jest.fn(),
    updatePosting: jest.fn(),
    createInterview: jest.fn(),
    updateInterview: jest.fn(),
    createOffer: jest.fn(),
    updateOffer: jest.fn(),
    findInterviewsByApplication: jest.fn().mockResolvedValue([]),
    findOfferByApplication: jest.fn().mockResolvedValue(null),
    updateReferenceCheck: jest.fn(),
    markMfaRegistered: jest.fn().mockResolvedValue({}),
    completeOnboarding: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as RecruitmentRepository);

const makeSvc = (overrides: Partial<RecruitmentRepository> = {}) =>
  new RecruitmentService(makeRepo(overrides));

describe("RecruitmentService.startOnboarding", () => {
  it("otpCode는 bcrypt 해시로 저장된다 (평문 6자리가 아님)", async () => {
    const repo = makeRepo();
    const svc = new RecruitmentService(repo);
    await svc.startOnboarding(1, 42);

    const storedHash = (repo.createOnboarding as jest.Mock).mock.calls[0][2] as string;
    expect(storedHash).toMatch(/^\$2b\$/);
    expect(storedHash).not.toMatch(/^\d{6}$/);
  });

  it("응답의 otpCode는 평문 6자리 숫자다", async () => {
    const svc = makeSvc();
    const result = await svc.startOnboarding(1, 42);
    expect(result.otpCode).toMatch(/^\d{6}$/);
  });

  it("두 결과 모두 6자리 형식이다", async () => {
    const svc = makeSvc();
    const r1 = await svc.startOnboarding(1, 42);
    const r2 = await svc.startOnboarding(1, 42);
    expect(r1.otpCode).toMatch(/^\d{6}$/);
    expect(r2.otpCode).toMatch(/^\d{6}$/);
  });
});

describe("RecruitmentService.verifyEmail", () => {
  let correctOtp: string;
  let otpHash: string;

  beforeAll(async () => {
    correctOtp = "123456";
    otpHash = await bcrypt.hash(correctOtp, 10);
  });

  const makeOnboarding = (overrides = {}) => ({
    id: 1, applicationId: 1, userId: 1,
    otpCode: otpHash,
    otpExpiresAt: new Date(Date.now() + 60_000),
    emailVerifiedAt: null,
    mfaRegisteredAt: null,
    ...overrides,
  });

  it("올바른 OTP → 이메일 인증 성공", async () => {
    const svc = makeSvc({
      findOnboardingByApplication: jest.fn().mockResolvedValue(makeOnboarding()),
    });
    await expect(svc.verifyEmail(1, correctOtp)).resolves.toBeDefined();
  });

  it("잘못된 OTP → 400 INVALID_OTP", async () => {
    const svc = makeSvc({
      findOnboardingByApplication: jest.fn().mockResolvedValue(makeOnboarding()),
    });
    await expect(svc.verifyEmail(1, "999999")).rejects.toMatchObject({
      statusCode: 400, message: "INVALID_OTP",
    });
  });

  it("만료된 OTP → 400 OTP_EXPIRED", async () => {
    const svc = makeSvc({
      findOnboardingByApplication: jest.fn().mockResolvedValue(
        makeOnboarding({ otpExpiresAt: new Date(Date.now() - 1000) })
      ),
    });
    await expect(svc.verifyEmail(1, correctOtp)).rejects.toMatchObject({
      statusCode: 400, message: "OTP_EXPIRED",
    });
  });

  it("이미 인증된 이메일 → 409 EMAIL_ALREADY_VERIFIED", async () => {
    const svc = makeSvc({
      findOnboardingByApplication: jest.fn().mockResolvedValue(
        makeOnboarding({ emailVerifiedAt: new Date() })
      ),
    });
    await expect(svc.verifyEmail(1, correctOtp)).rejects.toMatchObject({
      statusCode: 409, message: "EMAIL_ALREADY_VERIFIED",
    });
  });
});

describe("RecruitmentService.createPosting", () => {
  const makePlanReportRepo = (overrides: any = {}): any => ({
    findByIdLight: jest.fn().mockResolvedValue({
      id: 1,
      status: "APPROVED",
      templateType: "HR",
      departmentId: 10,
      title: "2026 상반기 채용 계획",
      jobPostings: [], // 이제 array — schema 변경 후 필드 이름
    }),
    findHiringPlanItemById: jest.fn().mockResolvedValue({
      id: 500,
      planReportId: 1,
      status: "PLANNED",
    }),
    updateHiringPlanItemStatus: jest.fn().mockResolvedValue({}),
    ...overrides,
  });

  const makeSvcWithPlanRepo = (
    planRepoOverrides: any = {},
    repoOverrides: Partial<RecruitmentRepository> = {},
  ) =>
    new RecruitmentService(
      makeRepo(repoOverrides),
      undefined,
      makePlanReportRepo(planRepoOverrides),
    );

  const validDto = {
    planReportId: 1,
    title: "수비코치 채용",
    description: "수비진 강화를 위한 코치 채용",
    departmentId: 10,
    headcount: 3,
    hiringPlanItemId: 500,
  } as any;

  it("PlanReport 에 이미 JobPosting 이 있어도 새 posting 생성 가능해야 함 (다중 role 지원)", async () => {
    const svc = makeSvcWithPlanRepo(
      {
        findByIdLight: jest.fn().mockResolvedValue({
          id: 1,
          status: "APPROVED",
          templateType: "HR",
          departmentId: 10,
          title: "2026 상반기 채용 계획",
          // 현재 code 는 .jobPosting (singular) 를 읽어 체크함 → 이 필드로 현재 버그 재현.
          // fix 후에는 이 체크가 삭제되므로 두 필드 다 무시되고 posting 생성 성공.
          jobPosting: { id: 100 },
          jobPostings: [{ id: 100 }],
        }),
      },
      {
        createPosting: jest.fn().mockResolvedValue({ id: 101, title: "수비코치 채용" }),
      },
    );

    await expect(svc.createPosting(validDto, 42)).resolves.toEqual({
      id: 101,
      title: "수비코치 채용",
    });
  });

  it("PlanReport 승인 안 되면 409 PLAN_REPORT_NOT_APPROVED", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        status: "DRAFT",
        templateType: "HR",
        departmentId: 10,
        title: "test",
        jobPostings: [],
      }),
    });

    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 409,
      message: "PLAN_REPORT_NOT_APPROVED",
    });
  });

  it("PlanReport HR 타입 아니면 409 PLAN_REPORT_NOT_HR_TYPE", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        status: "APPROVED",
        templateType: "MARKETING",
        departmentId: 10,
        title: "test",
        jobPostings: [],
      }),
    });

    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 409,
      message: "PLAN_REPORT_NOT_HR_TYPE",
    });
  });

  it("PlanReport 없으면 404 PLAN_REPORT_NOT_FOUND", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue(null),
    });

    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 404,
      message: "PLAN_REPORT_NOT_FOUND",
    });
  });

  it("hiringPlanItemId 없으면 400 HIRING_PLAN_ITEM_REQUIRED", async () => {
    const svc = makeSvcWithPlanRepo();
    // validDto 는 hiringPlanItemId 포함, 이 테스트는 제외 후 전송
    const dtoWithoutItem = { ...validDto, hiringPlanItemId: undefined } as any;
    await expect(svc.createPosting(dtoWithoutItem, 42)).rejects.toMatchObject({
      statusCode: 400,
      message: "HIRING_PLAN_ITEM_REQUIRED",
    });
  });

  it("hiringPlanItemId 가 존재하지 않으면 404 HIRING_PLAN_ITEM_NOT_FOUND", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        status: "APPROVED",
        templateType: "HR",
        departmentId: 10,
        title: "test",
        jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue(null),
    });
    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 404,
      message: "HIRING_PLAN_ITEM_NOT_FOUND",
    });
  });

  it("hiringPlanItemId 가 다른 planReport 소속이면 400 HIRING_PLAN_ITEM_MISMATCH", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1,
        status: "APPROVED",
        templateType: "HR",
        departmentId: 10,
        title: "test",
        jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500,
        planReportId: 999, // ← 다른 계획서 소속
        status: "PLANNED",
      }),
    });
    await expect(svc.createPosting(validDto, 42)).rejects.toMatchObject({
      statusCode: 400,
      message: "HIRING_PLAN_ITEM_MISMATCH",
    });
  });

  it("첫 JobPosting 생성 시 HiringPlanItem status 를 IN_PROGRESS 로 전이", async () => {
    const updateHiringPlanItemStatus = jest.fn().mockResolvedValue({});
    const svc = new RecruitmentService(
      makeRepo({
        createPosting: jest.fn().mockResolvedValue({ id: 101, title: "test" }) as any,
      }),
      undefined,
      makePlanReportRepo({
        findByIdLight: jest.fn().mockResolvedValue({
          id: 1,
          status: "APPROVED",
          templateType: "HR",
          departmentId: 10,
          title: "test",
          jobPostings: [],
        }),
        findHiringPlanItemById: jest.fn().mockResolvedValue({
          id: 500,
          planReportId: 1,
          status: "PLANNED",
        }),
        updateHiringPlanItemStatus,
      }),
    );

    await svc.createPosting({ ...validDto, hiringPlanItemId: 500 }, 42);

    expect(updateHiringPlanItemStatus).toHaveBeenCalledWith(500, "IN_PROGRESS");
  });

  it("이미 IN_PROGRESS 인 HiringPlanItem 은 status 재 update 안 함 (idempotent)", async () => {
    const updateHiringPlanItemStatus = jest.fn().mockResolvedValue({});
    const svc = new RecruitmentService(
      makeRepo({
        createPosting: jest.fn().mockResolvedValue({ id: 101, title: "test" }) as any,
      }),
      undefined,
      makePlanReportRepo({
        findByIdLight: jest.fn().mockResolvedValue({
          id: 1, status: "APPROVED", templateType: "HR",
          departmentId: 10, title: "test", jobPostings: [],
        }),
        findHiringPlanItemById: jest.fn().mockResolvedValue({
          id: 500, planReportId: 1, status: "IN_PROGRESS",
        }),
        updateHiringPlanItemStatus,
      }),
    );

    await svc.createPosting({ ...validDto, hiringPlanItemId: 500 }, 42);

    expect(updateHiringPlanItemStatus).not.toHaveBeenCalled();
  });

  it("HiringPlanItem status === 'FULFILLED' 이면 409 HIRING_PLAN_ITEM_ALREADY_FULFILLED", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1, status: "APPROVED", templateType: "HR",
        departmentId: 10, title: "test", jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, status: "FULFILLED",
      }),
    });

    await expect(svc.createPosting({ ...validDto, hiringPlanItemId: 500 }, 42))
      .rejects.toMatchObject({ statusCode: 409, message: "HIRING_PLAN_ITEM_ALREADY_FULFILLED" });
  });

  it("HiringPlanItem status === 'CANCELLED' 이면 409 HIRING_PLAN_ITEM_CANCELLED", async () => {
    const svc = makeSvcWithPlanRepo({
      findByIdLight: jest.fn().mockResolvedValue({
        id: 1, status: "APPROVED", templateType: "HR",
        departmentId: 10, title: "test", jobPostings: [],
      }),
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, status: "CANCELLED",
      }),
    });

    await expect(svc.createPosting({ ...validDto, hiringPlanItemId: 500 }, 42))
      .rejects.toMatchObject({ statusCode: 409, message: "HIRING_PLAN_ITEM_CANCELLED" });
  });
});

describe("RecruitmentService.completeMfa (HiringPlanItem status)", () => {
  beforeEach(() => {
    mockHiringPlanItem.findUnique.mockReset();
    mockHiringPlanItem.update.mockReset();
    mockHiringPlanItem.updateMany.mockReset();
  });

  const makeMfaCtx = (
    repoOverrides: any = {},
    planRepoOverrides: any = {},
    txItemState: any = { id: 500, headcount: 3, fulfilledCount: 0, status: "IN_PROGRESS" },
    txUpdateResult: any = { fulfilledCount: 1, headcount: 3 },
  ) => {
    const repo = makeRepo({
      findOnboardingByApplication: jest.fn().mockResolvedValue({
        id: 1, applicationId: 1, userId: 1,
        otpCode: "hash", otpExpiresAt: new Date(Date.now() + 60_000),
        emailVerifiedAt: new Date(),
        mfaRegisteredAt: null,
      }),
      markMfaRegistered: jest.fn().mockResolvedValue({ mfaRegisteredAt: new Date() }),
      findApplicationById: jest.fn().mockResolvedValue({
        id: 1,
        applicantName: "테스트",
        offeredById: 42,
        posting: {
          id: 100,
          title: "Coach",
          hiringPlanItemId: 500,
        },
      }),
      completeOnboarding: jest.fn().mockResolvedValue({}),
      ...repoOverrides,
    });
    const planRepo = {
      findHiringPlanItemById: jest.fn().mockResolvedValue({
        id: 500, planReportId: 1, headcount: 3, fulfilledCount: 0, status: "IN_PROGRESS",
      }),
      incrementFulfilledCount: jest.fn().mockResolvedValue({ id: 500, headcount: 3, fulfilledCount: 1, status: "IN_PROGRESS" }),
      updateHiringPlanItemStatus: jest.fn().mockResolvedValue({}),
      ...planRepoOverrides,
    } as any;
    mockHiringPlanItem.findUnique.mockResolvedValue(txItemState);
    mockHiringPlanItem.update.mockResolvedValue(txUpdateResult);
    mockHiringPlanItem.updateMany.mockResolvedValue({ count: 1 });
    return { svc: new RecruitmentService(repo, undefined, planRepo), repo, planRepo };
  };

  it("Application 온보딩 완료 시 HiringPlanItem.fulfilledCount 증가 (tx 안에서 update)", async () => {
    const { svc } = makeMfaCtx();
    await svc.completeMfa(1);
    expect(mockHiringPlanItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 500 },
        data: { fulfilledCount: { increment: 1 } },
      }),
    );
  });

  it("fulfilledCount 가 headcount 도달 시 FULFILLED 로 전이 (updateMany with IN_PROGRESS guard)", async () => {
    const { svc } = makeMfaCtx(
      {},
      {},
      { id: 500, headcount: 3, fulfilledCount: 2, status: "IN_PROGRESS" },
      { fulfilledCount: 3, headcount: 3 },
    );
    await svc.completeMfa(1);
    expect(mockHiringPlanItem.updateMany).toHaveBeenCalledWith({
      where: { id: 500, status: "IN_PROGRESS" },
      data: { status: "FULFILLED", fulfilledAt: expect.any(Date) },
    });
  });

  it("fulfilledCount < headcount 이면 FULFILLED 전이 skip", async () => {
    const { svc } = makeMfaCtx(
      {},
      {},
      { id: 500, headcount: 3, fulfilledCount: 0, status: "IN_PROGRESS" },
      { fulfilledCount: 1, headcount: 3 },
    );
    await svc.completeMfa(1);
    expect(mockHiringPlanItem.updateMany).not.toHaveBeenCalled();
  });

  it("posting 에 hiringPlanItemId 없으면 (legacy) tx 자체 skip", async () => {
    const { svc } = makeMfaCtx({
      findApplicationById: jest.fn().mockResolvedValue({
        id: 1, applicantName: "테스트", offeredById: 42,
        posting: { id: 100, title: "Coach", hiringPlanItemId: null },
      }),
    });
    await svc.completeMfa(1);
    expect(mockHiringPlanItem.findUnique).not.toHaveBeenCalled();
    expect(mockHiringPlanItem.update).not.toHaveBeenCalled();
    expect(mockHiringPlanItem.updateMany).not.toHaveBeenCalled();
  });

  it("HiringPlanItem 이 이미 CANCELLED 이면 fulfilledCount 증가 skip", async () => {
    const { svc } = makeMfaCtx(
      {},
      {},
      { id: 500, headcount: 3, fulfilledCount: 0, status: "CANCELLED" },
    );
    await svc.completeMfa(1);
    expect(mockHiringPlanItem.update).not.toHaveBeenCalled();
    expect(mockHiringPlanItem.updateMany).not.toHaveBeenCalled();
  });
});

describe("RecruitmentService.bulkCreatePostingsFromPlanReport", () => {
  const planReportData = {
    id: 1,
    title: "2026 Q4 채용 계획",
    status: "APPROVED",
    templateType: "HR",
    departmentId: 10,
    jobPostings: [],
  };

  const items = [
    { id: 101, planReportId: 1, roleTitle: "수비코치", headcount: 2, priority: "HIGH", status: "PLANNED", quarter: 4, estimatedBudget: 50000000 },
    { id: 102, planReportId: 1, roleTitle: "GK코치", headcount: 1, priority: "MEDIUM", status: "IN_PROGRESS", quarter: 4, estimatedBudget: 30000000 },
    { id: 103, planReportId: 1, roleTitle: "물리치료사", headcount: 2, priority: "HIGH", status: "PLANNED", quarter: 4, estimatedBudget: 40000000 },
    { id: 104, planReportId: 1, roleTitle: "취소된 role", headcount: 1, priority: "LOW", status: "CANCELLED", quarter: 4, estimatedBudget: 20000000 },
    { id: 105, planReportId: 1, roleTitle: "완료된 role", headcount: 1, priority: "LOW", status: "FULFILLED", quarter: 4, estimatedBudget: 20000000 },
  ];

  const makeSvcWithBulkContext = (
    listHiringPlanItemsResult = items,
    createPostingResults = [{ id: 500 }, { id: 501 }],
  ) => {
    const repo = makeRepo({
      createPosting: jest.fn()
        .mockResolvedValueOnce(createPostingResults[0])
        .mockResolvedValueOnce(createPostingResults[1]),
    });
    const planRepo = {
      findByIdLight: jest.fn().mockResolvedValue(planReportData),
      findHiringPlanItemById: jest.fn().mockImplementation((id) => {
        const item = items.find(i => i.id === id);
        return Promise.resolve(item ?? null);
      }),
      listHiringPlanItems: jest.fn().mockResolvedValue(listHiringPlanItemsResult),
      updateHiringPlanItemStatus: jest.fn().mockResolvedValue({}),
    } as any;
    const svc = new RecruitmentService(repo, undefined, planRepo);
    return { svc, repo, planRepo };
  };

  it("PLANNED 상태 item 들만 posting 생성, 나머지는 skip", async () => {
    const { svc, planRepo } = makeSvcWithBulkContext();

    const result = await svc.bulkCreatePostingsFromPlanReport(1, 42);

    // 2개 PLANNED (101, 103) → posting 생성
    expect(result.created).toHaveLength(2);
    // 3개 non-PLANNED (102 IN_PROGRESS, 104 CANCELLED, 105 FULFILLED) → skip
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.map((s: any) => s.id).sort()).toEqual([102, 104, 105]);
    expect(result.skipped.map((s: any) => s.status).sort()).toEqual(["CANCELLED", "FULFILLED", "IN_PROGRESS"]);

    // listHiringPlanItems 는 planReportId 기준 조회 (status filter 없이 전체)
    expect(planRepo.listHiringPlanItems).toHaveBeenCalledWith(1);
  });

  it("생성된 posting 은 default title/description 갖고, hiringPlanItemId 자동 연결", async () => {
    const { svc, repo } = makeSvcWithBulkContext();

    await svc.bulkCreatePostingsFromPlanReport(1, 42);

    const calls = (repo.createPosting as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    // 첫 posting (id 101, 수비코치)
    expect(calls[0][0]).toMatchObject({
      planReportId: 1,
      hiringPlanItemId: 101,
      title: "2026 Q4 채용 계획 - 수비코치",
      headcount: 2,
      departmentId: 10,
      createdById: 42,
    });
    expect(calls[0][0].description).toContain("수비코치");
    expect(calls[0][0].description).toContain("2"); // headcount
  });

  it("planReport 없으면 404 PLAN_REPORT_NOT_FOUND", async () => {
    const { svc } = makeSvcWithBulkContext();
    const planRepo = {
      findByIdLight: jest.fn().mockResolvedValue(null),
      listHiringPlanItems: jest.fn(),
    } as any;
    const svcNoReport = new RecruitmentService(makeRepo(), undefined, planRepo);

    await expect(svcNoReport.bulkCreatePostingsFromPlanReport(999, 42))
      .rejects.toMatchObject({ statusCode: 404, message: "PLAN_REPORT_NOT_FOUND" });
  });

  it("planReport 가 HR 이 아니거나 승인 안 됨 시 409", async () => {
    const planRepo = {
      findByIdLight: jest.fn().mockResolvedValue({ ...planReportData, templateType: "GENERAL" }),
      listHiringPlanItems: jest.fn(),
    } as any;
    const svc = new RecruitmentService(makeRepo(), undefined, planRepo);

    await expect(svc.bulkCreatePostingsFromPlanReport(1, 42))
      .rejects.toMatchObject({ statusCode: 409, message: "PLAN_REPORT_NOT_HR_TYPE" });
  });

  it("모든 item 이 non-PLANNED 이면 created 는 빈 배열, skipped 만 반환 (에러 아님)", async () => {
    const allNonPlanned = items.filter(i => i.status !== "PLANNED");
    const { svc } = makeSvcWithBulkContext(allNonPlanned);

    const result = await svc.bulkCreatePostingsFromPlanReport(1, 42);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(3);
  });
});

describe("RecruitmentService.getInterviewerScoreAggregate", () => {
  const interview = {
    id: 100,
    applicationId: 1,
    round: "ROUND_1",
    scoreSkill: null,
    scoreComm: null,
    scoreCulture: null,
  };

  const makeSvcWithAggCtx = (aggregateResult: any = null, findInterviewResult: any = interview) => {
    const repo = makeRepo({
      findInterview: jest.fn().mockResolvedValue(findInterviewResult),
      aggregateInterviewerScores: jest.fn().mockResolvedValue(aggregateResult),
      updateInterview: jest.fn().mockResolvedValue({}),
    });
    return { svc: new RecruitmentService(repo), repo };
  };

  it("3명 면접관 (5, 7, 9) 평균 → scoreSkill=7 (반올림), method=AVG, count=3", async () => {
    const { svc } = makeSvcWithAggCtx({
      _avg: { scoreSkill: 7.0, scoreComm: 6.5, scoreCulture: 8.0 },
      _count: 3,
    });
    const result = await svc.getInterviewerScoreAggregate(1, "ROUND_1");
    expect(result).toEqual({
      scoreSkill: 7,
      scoreComm: 7,      // 6.5 → 7 (round)
      scoreCulture: 8,
      method: "AVG",
      count: 3,
    });
  });

  it("0 scores → 400 NO_INTERVIEWER_SCORES_YET", async () => {
    const { svc } = makeSvcWithAggCtx({
      _avg: { scoreSkill: null, scoreComm: null, scoreCulture: null },
      _count: 0,
    });
    await expect(svc.getInterviewerScoreAggregate(1, "ROUND_1"))
      .rejects.toMatchObject({ statusCode: 400, message: "NO_INTERVIEWER_SCORES_YET" });
  });

  it("Interview 없으면 404 INTERVIEW_NOT_FOUND", async () => {
    const { svc } = makeSvcWithAggCtx(null, null);
    await expect(svc.getInterviewerScoreAggregate(1, "ROUND_1"))
      .rejects.toMatchObject({ statusCode: 404, message: "INTERVIEW_NOT_FOUND" });
  });

  it("일부 카테고리 null 이면 그 값만 null 반환 (다른 카테고리는 정상 평균)", async () => {
    const { svc } = makeSvcWithAggCtx({
      _avg: { scoreSkill: 7.0, scoreComm: null, scoreCulture: 8.0 },
      _count: 2,
    });
    const result = await svc.getInterviewerScoreAggregate(1, "ROUND_1");
    expect(result).toEqual({
      scoreSkill: 7,
      scoreComm: null,
      scoreCulture: 8,
      method: "AVG",
      count: 2,
    });
  });
});

describe("RecruitmentService.finalizeInterviewScore", () => {
  const interview = {
    id: 100,
    applicationId: 1,
    round: "ROUND_1",
    scoreSkill: null,
    scoreComm: null,
    scoreCulture: null,
  };

  const makeSvcFinalize = (aggregateResult: any = null, findInterviewResult: any = interview, updateResult: any = {}) => {
    const repo = makeRepo({
      findInterview: jest.fn().mockResolvedValue(findInterviewResult),
      aggregateInterviewerScores: jest.fn().mockResolvedValue(aggregateResult),
      updateInterview: jest.fn().mockResolvedValue(updateResult),
    });
    return { svc: new RecruitmentService(repo), repo };
  };

  it("aggregate 결과로 Interview.score* 업데이트", async () => {
    const { svc, repo } = makeSvcFinalize({
      _avg: { scoreSkill: 7.0, scoreComm: 6.5, scoreCulture: 8.0 },
      _count: 3,
    }, interview, { id: 100, scoreSkill: 7, scoreComm: 7, scoreCulture: 8 });

    const result = await svc.finalizeInterviewScore(1, "ROUND_1");

    expect(repo.updateInterview).toHaveBeenCalledWith(1, "ROUND_1", {
      scoreSkill: 7,
      scoreComm: 7,
      scoreCulture: 8,
    });
    expect(result.scoreSkill).toBe(7);
  });

  it("0 scores → 400 NO_INTERVIEWER_SCORES_YET (Interview 업데이트 안 함)", async () => {
    const { svc, repo } = makeSvcFinalize({
      _avg: { scoreSkill: null, scoreComm: null, scoreCulture: null },
      _count: 0,
    });
    await expect(svc.finalizeInterviewScore(1, "ROUND_1"))
      .rejects.toMatchObject({ statusCode: 400, message: "NO_INTERVIEWER_SCORES_YET" });
    expect(repo.updateInterview).not.toHaveBeenCalled();
  });

  it("Interview 없으면 404 INTERVIEW_NOT_FOUND", async () => {
    const { svc, repo } = makeSvcFinalize(null, null);
    await expect(svc.finalizeInterviewScore(1, "ROUND_1"))
      .rejects.toMatchObject({ statusCode: 404, message: "INTERVIEW_NOT_FOUND" });
    expect(repo.updateInterview).not.toHaveBeenCalled();
  });
});

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

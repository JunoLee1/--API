import bcrypt from "bcrypt";
import { RecruitmentService } from "./recruitment.service";
import type { RecruitmentRepository } from "./recruitment.repo";

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
});

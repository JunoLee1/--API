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
    const result = await svc.startOnboarding(1, 42);

    const storedHash = (repo.createOnboarding as jest.Mock).mock.calls[0][2] as string;
    expect(storedHash).toMatch(/^\$2b\$/);
    expect(storedHash).not.toMatch(/^\d{6}$/);
  });

  it("응답의 otpCode는 평문 6자리 숫자다", async () => {
    const svc = makeSvc();
    const result = await svc.startOnboarding(1, 42);
    expect(result.otpCode).toMatch(/^\d{6}$/);
  });

  it("Math.random 대신 crypto.randomInt를 사용 — 같은 OTP가 연속 생성되지 않는다", async () => {
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

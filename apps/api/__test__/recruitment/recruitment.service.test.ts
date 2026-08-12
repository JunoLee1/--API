import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { RecruitmentService } from "../../src/recruitment/recruitment.service";

const mockRepo = {
  findPostingById: jest.fn(),
  findAllPostings: jest.fn(),
  createPosting: jest.fn(),
  updatePosting: jest.fn(),
  approvePosting: jest.fn(),
  closePosting: jest.fn(),
  findApplicationsByPosting: jest.fn(),
  findApplicationById: jest.fn(),
  createApplication: jest.fn(),
  updateApplication: jest.fn(),
  rejectApplication: jest.fn(),
  offerApplication: jest.fn(),
  setApplicationStatus: jest.fn(),
  findInterview: jest.fn(),
  createInterview: jest.fn(),
  updateInterview: jest.fn(),
  createReferenceCheck: jest.fn(),
  updateReferenceCheck: jest.fn(),
  createOnboarding: jest.fn(),
  findOnboardingByApplication: jest.fn(),
  markEmailVerified: jest.fn(),
  markMfaRegistered: jest.fn(),
} as any;

const service = new RecruitmentService(mockRepo);

beforeEach(() => jest.clearAllMocks());

describe("scheduleInterview", () => {
  test("ROUND_1 예약 시 status를 INTERVIEW_1로 전환한다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "APPLIED" });
    mockRepo.findInterview.mockResolvedValue(null);
    mockRepo.setApplicationStatus.mockResolvedValue({});
    mockRepo.createInterview.mockResolvedValue({ id: 10 });

    await service.scheduleInterview(1, { round: "ROUND_1" });

    expect(mockRepo.setApplicationStatus).toHaveBeenCalledWith(1, "INTERVIEW_1");
  });

  test("ROUND_2 예약 시 status를 INTERVIEW_2로 전환한다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "INTERVIEW_1" });
    mockRepo.findInterview.mockResolvedValue(null);
    mockRepo.setApplicationStatus.mockResolvedValue({});
    mockRepo.createInterview.mockResolvedValue({ id: 11 });

    await service.scheduleInterview(1, { round: "ROUND_2" });

    expect(mockRepo.setApplicationStatus).toHaveBeenCalledWith(1, "INTERVIEW_2");
  });

  test("이미 면접이 있으면 409 INTERVIEW_ALREADY_EXISTS를 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "INTERVIEW_1" });
    mockRepo.findInterview.mockResolvedValue({ round: "ROUND_1" });

    await expect(service.scheduleInterview(1, { round: "ROUND_1" })).rejects.toMatchObject({
      statusCode: 409,
      code: "INTERVIEW_ALREADY_EXISTS",
    });

    expect(mockRepo.setApplicationStatus).not.toHaveBeenCalled();
  });
});

describe("createReferenceCheck", () => {
  test("레퍼런스 체크 생성 시 status를 REFERENCE_CHECK로 전환한다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "INTERVIEW_2" });
    mockRepo.setApplicationStatus.mockResolvedValue({});
    mockRepo.createReferenceCheck.mockResolvedValue({ id: 5 });

    await service.createReferenceCheck(1, { contactName: "홍길동", relationship: "전 직장 상사" });

    expect(mockRepo.setApplicationStatus).toHaveBeenCalledWith(1, "REFERENCE_CHECK");
    expect(mockRepo.createReferenceCheck).toHaveBeenCalledWith(1, {
      contactName: "홍길동",
      relationship: "전 직장 상사",
    });
  });
});

describe("offerApplication", () => {
  test("REFERENCE_CHECK 상태가 아니면 409 APPLICATION_NOT_IN_REFERENCE_CHECK를 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "INTERVIEW_2" });

    await expect(service.offerApplication(1, 99)).rejects.toMatchObject({
      statusCode: 409,
      code: "APPLICATION_NOT_IN_REFERENCE_CHECK",
    });
  });
});

describe("rejectApplication", () => {
  test("이미 REJECTED이면 409 APPLICATION_ALREADY_REJECTED를 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "REJECTED" });

    await expect(service.rejectApplication(1)).rejects.toMatchObject({
      statusCode: 409,
      code: "APPLICATION_ALREADY_REJECTED",
    });
  });
});

describe("approvePosting", () => {
  test("DRAFT가 아니면 409 JOB_POSTING_NOT_DRAFT를 던진다", async () => {
    mockRepo.findPostingById.mockResolvedValue({ id: 1, status: "OPEN" });

    await expect(service.approvePosting(1, 99)).rejects.toMatchObject({
      statusCode: 409,
      code: "JOB_POSTING_NOT_DRAFT",
    });
  });
});

describe("updateApplication", () => {
  test("SCREENING으로 status 변경이 허용된다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "APPLIED" });
    mockRepo.updateApplication.mockResolvedValue({ id: 1, status: "SCREENING" });

    await service.updateApplication(1, { status: "SCREENING" });

    expect(mockRepo.updateApplication).toHaveBeenCalledWith(1, { status: "SCREENING" });
  });

  test("SCREENING 외 status는 400 INVALID_STATUS_TRANSITION을 던진다", async () => {
    mockRepo.findApplicationById.mockResolvedValue({ id: 1, status: "APPLIED" });

    await expect(
      service.updateApplication(1, { status: "INTERVIEW_1" as any }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_STATUS_TRANSITION" });

    expect(mockRepo.updateApplication).not.toHaveBeenCalled();
  });
});

describe("updateInterviewRound", () => {
  test("result=PASS이고 scoreSkill이 null이면 400 INTERVIEW_SCORES_REQUIRED를 던진다", async () => {
    mockRepo.findInterview.mockResolvedValue({
      id: 1,
      applicationId: 1,
      round: "ROUND_1",
      scoreSkill: null,
      scoreComm: 4,
      scoreCulture: 3,
      result: "PENDING",
    });

    await expect(
      service.updateInterview(1, "ROUND_1", { result: "PASS" }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INTERVIEW_SCORES_REQUIRED" });

    expect(mockRepo.updateInterview).not.toHaveBeenCalled();
  });

  test("result=PASS이고 세 점수 모두 존재하면 정상 처리된다", async () => {
    mockRepo.findInterview.mockResolvedValue({
      id: 1,
      applicationId: 1,
      round: "ROUND_1",
      scoreSkill: 4,
      scoreComm: 4,
      scoreCulture: 3,
      result: "PENDING",
    });
    mockRepo.updateInterview.mockResolvedValue({ id: 1, result: "PASS" });

    await service.updateInterview(1, "ROUND_1", { result: "PASS" });

    expect(mockRepo.updateInterview).toHaveBeenCalledWith(1, "ROUND_1", { result: "PASS" });
  });
});

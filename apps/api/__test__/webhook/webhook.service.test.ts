import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { WebhookService } from "../../src/webhook/webhook.service";
import { AppError } from "../../src/lib/appError";
import type { NormalizedApplication } from "../../src/webhook/adapters/types";
import type { ApplicationSource } from "../../src/generated/enums";

const mockPrisma = {
  jobPosting: {
    findFirst: jest.fn(),
  },
  jobApplication: {
    upsert: jest.fn(),
  },
} as any;

const service = new WebhookService(mockPrisma);

const normalized: NormalizedApplication = {
  externalJobId: "saramin-job-1",
  externalApplicantId: "saramin-app-1",
  applicantName: "홍길동",
  email: "hong@example.com",
  phone: "010-1234-5678",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("WebhookService.handleInbound", () => {
  test("JobPosting을 찾지 못하면 404를 던진다", async () => {
    (mockPrisma.jobPosting.findFirst as any).mockResolvedValue(null);
    await expect(
      service.handleInbound(normalized, "SARAMIN" as ApplicationSource),
    ).rejects.toMatchObject({ statusCode: 404, code: "JOB_POSTING_NOT_FOUND" });
  });

  test("JobPosting을 찾으면 upsert를 호출한다", async () => {
    (mockPrisma.jobPosting.findFirst as any).mockResolvedValue({ id: 5 });
    (mockPrisma.jobApplication.upsert as any).mockResolvedValue({ id: 1 });

    await service.handleInbound(normalized, "SARAMIN" as ApplicationSource);

    expect(mockPrisma.jobApplication.upsert).toHaveBeenCalledWith({
      where: {
        postingId_externalApplicantId: {
          postingId: 5,
          externalApplicantId: "saramin-app-1",
        },
      },
      create: {
        postingId: 5,
        externalApplicantId: "saramin-app-1",
        applicantName: "홍길동",
        email: "hong@example.com",
        phone: "010-1234-5678",
        resumeUrl: undefined,
        source: "SARAMIN",
        status: "APPLIED",
      },
      update: {},
    });
  });

  test("upsert 결과를 반환한다", async () => {
    (mockPrisma.jobPosting.findFirst as any).mockResolvedValue({ id: 5 });
    const mockApp = { id: 99 };
    (mockPrisma.jobApplication.upsert as any).mockResolvedValue(mockApp);

    const result = await service.handleInbound(normalized, "SARAMIN" as ApplicationSource);
    expect(result).toBe(mockApp);
  });
});

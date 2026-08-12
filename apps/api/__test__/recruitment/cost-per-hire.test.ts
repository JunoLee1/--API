import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { RecruitmentRepository } from "../../src/recruitment/recruitment.repo";

// Minimal prisma mock — only what getCostPerHire needs
const mockPrisma = {
  jobPosting: {
    findMany: jest.fn(),
  },
} as any;

const repo = new RecruitmentRepository(mockPrisma);

beforeEach(() => jest.clearAllMocks());

describe("RecruitmentRepository.getCostPerHire", () => {
  test("hiredCount > 0 이면 costPerHire = round(budget / hiredCount)", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([
      {
        id: 1,
        title: "FW 선수 채용",
        budget: 3000000,
        applications: [
          { status: "ONBOARDED" },
          { status: "ONBOARDED" },
          { status: "REJECTED" },
        ],
      },
    ]);

    const result = await repo.getCostPerHire();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      postingId: 1,
      title: "FW 선수 채용",
      budget: 3000000,
      hiredCount: 2,
      costPerHire: 1500000,
    });
  });

  test("hiredCount = 0 이면 costPerHire = 0", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([
      {
        id: 2,
        title: "GK 채용",
        budget: 1000000,
        applications: [{ status: "REJECTED" }, { status: "SCREENING" }],
      },
    ]);

    const result = await repo.getCostPerHire();

    expect(result[0]).toMatchObject({
      postingId: 2,
      hiredCount: 0,
      costPerHire: 0,
    });
  });

  test("budget이 null이면 budget = 0으로 처리한다", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([
      {
        id: 3,
        title: "MF 채용",
        budget: null,
        applications: [{ status: "ONBOARDED" }],
      },
    ]);

    const result = await repo.getCostPerHire();

    expect(result[0]).toMatchObject({
      postingId: 3,
      budget: 0,
      hiredCount: 1,
      costPerHire: 0,
    });
  });

  test("포스팅이 없으면 빈 배열 반환", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([]);

    const result = await repo.getCostPerHire();

    expect(result).toEqual([]);
  });
});

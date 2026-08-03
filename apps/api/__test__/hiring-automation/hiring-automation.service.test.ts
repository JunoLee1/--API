import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { HiringAutomationService } from "../../src/hiring-automation/hiring-automation.service";

const mockRepo = {
  listLeagueWeights: jest.fn(),
  upsertLeagueWeight: jest.fn(),
  listIbiConfigs: jest.fn(),
  findIbiConfigById: jest.fn(),
  createIbiConfig: jest.fn(),
  updateIbiConfig: jest.fn(),
  deleteIbiConfig: jest.fn(),
  findComplianceCheck: jest.fn(),
  upsertComplianceCheck: jest.fn(),
  listComplianceDeadlines: jest.fn(),
  findComplianceDeadlineById: jest.fn(),
  createComplianceDeadline: jest.fn(),
  updateComplianceDeadline: jest.fn(),
  deleteComplianceDeadline: jest.fn(),
  getActiveComplianceDeadlineNearby: jest.fn(),
  getLeagueWeightMap: jest.fn(),
  getAllIbiConfigs: jest.fn(),
  getSeasonComplianceCheck: jest.fn(),
  checkAutoCompliance: jest.fn(),
  getActiveJobPostingsForDepartment: jest.fn(),
  createJobPostingDraft: jest.fn(),
} as any;

const service = new HiringAutomationService(mockRepo);

beforeEach(() => jest.clearAllMocks());

describe("upsertLeagueWeight", () => {
  test("weight가 0~1 범위를 벗어나면 400을 던진다", async () => {
    await expect(
      service.upsertLeagueWeight("K3" as any, "COMPLIANCE" as any, { weight: 1.5 }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_WEIGHT" });
  });

  test("유효한 weight이면 repo.upsertLeagueWeight를 호출한다", async () => {
    mockRepo.upsertLeagueWeight.mockResolvedValue({ weight: 0.28 });
    await service.upsertLeagueWeight("K3" as any, "COMPLIANCE" as any, { weight: 0.28 });
    expect(mockRepo.upsertLeagueWeight).toHaveBeenCalledWith("K3", "COMPLIANCE", { weight: 0.28 });
  });
});

describe("createIbiConfig", () => {
  test("coreTaskRatio가 범위를 벗어나면 400을 던진다", async () => {
    await expect(
      service.createIbiConfig({
        departmentId: 1,
        jobTitle: "HR",
        coreTaskRatio: 1.5,
        replacementDays: 30,
        backupHeadcount: 0,
        effectiveFrom: "2026-01-01",
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CORE_TASK_RATIO" });
  });
});

describe("getIbiConfig", () => {
  test("존재하지 않으면 404를 던진다", async () => {
    mockRepo.findIbiConfigById.mockResolvedValue(null);
    await expect(service.getIbiConfig(999)).rejects.toMatchObject({
      statusCode: 404,
      code: "IBI_CONFIG_NOT_FOUND",
    });
  });
});

describe("createComplianceDeadline", () => {
  test("betaMultiplier가 0 이하면 400을 던진다", async () => {
    await expect(
      service.createComplianceDeadline({
        name: "test",
        deadlineDate: "2026-12-01",
        triggerDaysBefore: 30,
        betaMultiplier: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_BETA_MULTIPLIER" });
  });
});

describe("computePriorityQueue", () => {
  test("규정 위반 없는 정상 케이스에서 점수를 계산한다", async () => {
    mockRepo.getAllIbiConfigs.mockResolvedValue([
      {
        departmentId: 1,
        coreTaskRatio: 0.8,
        replacementDays: 30,
        backupHeadcount: 1,
        department: { id: 1, name: "인사팀", category: "COMPLIANCE" },
      },
    ]);
    mockRepo.getLeagueWeightMap.mockResolvedValue([{ category: "COMPLIANCE", weight: 0.28 }]);
    mockRepo.checkAutoCompliance.mockResolvedValue({
      playerCount: 20,
      coachingCount: 6,
      medicalCount: 2,
      youthTeamCount: 1,
    });
    mockRepo.getSeasonComplianceCheck.mockResolvedValue({
      afcQualificationMet: true,
      officeStaffCountMet: true,
    });
    mockRepo.getActiveComplianceDeadlineNearby.mockResolvedValue(null);

    const result = await service.computePriorityQueue({ id: 1, leagueLevel: "K3" as any }, 1.0);

    // IBI = (0.8 * 30) / (1 + 1) = 12, score = 0 + 0.28 + 1.0 * 12 = 12.28
    expect(result.queue[0]!.score).toBe(12.28);
    expect(result.complianceViolation).toBe(false);
    expect(result.queue[0]!.highPriority).toBe(false);
  });

  test("규정 위반 시 COMPLIANCE 카테고리 부서가 highPriority를 받는다", async () => {
    mockRepo.getAllIbiConfigs.mockResolvedValue([
      {
        departmentId: 1,
        coreTaskRatio: 0.5,
        replacementDays: 10,
        backupHeadcount: 0,
        department: { id: 1, name: "인사팀", category: "COMPLIANCE" },
      },
    ]);
    mockRepo.getLeagueWeightMap.mockResolvedValue([{ category: "COMPLIANCE", weight: 0.28 }]);
    mockRepo.checkAutoCompliance.mockResolvedValue({
      playerCount: 10, // MIN_PLAYERS(18) 미달
      coachingCount: 6,
      medicalCount: 1,
      youthTeamCount: 1,
    });
    mockRepo.getSeasonComplianceCheck.mockResolvedValue(null);
    mockRepo.getActiveComplianceDeadlineNearby.mockResolvedValue(null);

    const result = await service.computePriorityQueue({ id: 1, leagueLevel: "K3" as any }, 1.0);

    expect(result.complianceViolation).toBe(true);
    expect(result.queue[0]!.highPriority).toBe(true);
    expect(result.queue[0]!.score).toBeGreaterThan(9000);
  });

  test("ComplianceDeadline이 triggerDaysBefore 이내이면 β_eff에 multiplier가 적용된다", async () => {
    mockRepo.getAllIbiConfigs.mockResolvedValue([
      {
        departmentId: 1,
        coreTaskRatio: 1.0,
        replacementDays: 10,
        backupHeadcount: 0,
        department: { id: 1, name: "재무팀", category: "FINANCE" },
      },
    ]);
    mockRepo.getLeagueWeightMap.mockResolvedValue([{ category: "FINANCE", weight: 0.23 }]);
    mockRepo.checkAutoCompliance.mockResolvedValue({
      playerCount: 20,
      coachingCount: 6,
      medicalCount: 1,
      youthTeamCount: 1,
    });
    mockRepo.getSeasonComplianceCheck.mockResolvedValue({
      afcQualificationMet: true,
      officeStaffCountMet: true,
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    mockRepo.getActiveComplianceDeadlineNearby.mockResolvedValue({
      deadlineDate: futureDate,
      triggerDaysBefore: 30,
      betaMultiplier: 3.0,
    });

    const result = await service.computePriorityQueue({ id: 1, leagueLevel: "K3" as any }, 1.0);

    // β_eff = 1.0 * 3.0 = 3.0
    expect(result.betaEff).toBe(3);
  });
});

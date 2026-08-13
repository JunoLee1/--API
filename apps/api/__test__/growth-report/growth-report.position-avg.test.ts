import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { GrowthReportRepository } from "../../src/growth-report/growth-report.repo";

const mockFindFirst = jest.fn();
const mockAggregate = jest.fn();
const mockCount = jest.fn();
const mockPrisma = {
  player: { findFirst: mockFindFirst },
  growthEvaluation: { aggregate: mockAggregate, count: mockCount },
} as any;

describe("GrowthReportRepository.getPositionAverage", () => {
  let repo: GrowthReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new GrowthReportRepository(mockPrisma);
  });

  test("returns position average scores and sample count", async () => {
    mockFindFirst.mockResolvedValue({ position: "STRIKER" });
    mockAggregate.mockResolvedValue({
      _avg: { attitudeScore: 7.5, fundamentalsScore: 6.8, spatialScore: 8.0, physicalScore: 7.2 },
    });
    mockCount.mockResolvedValue(4);

    const result = await repo.getPositionAverage("player-id-1");

    expect(result!.position).toBe("STRIKER");
    expect(result!.sampleCount).toBe(4);
    expect(result!.avgAttitudeScore).toBe(7.5);
    expect(result!.avgFundamentalsScore).toBe(6.8);
  });

  test("returns null when player not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await repo.getPositionAverage("unknown-player");
    expect(result).toBeNull();
  });

  test("returns sampleCount 0 with null averages when no evaluations exist", async () => {
    mockFindFirst.mockResolvedValue({ position: "GOALKEEPER" });
    mockAggregate.mockResolvedValue({
      _avg: { attitudeScore: null, fundamentalsScore: null, spatialScore: null, physicalScore: null },
    });
    mockCount.mockResolvedValue(0);

    const result = await repo.getPositionAverage("player-id-gk");
    expect(result!.sampleCount).toBe(0);
    expect(result!.avgAttitudeScore).toBeNull();
  });
});

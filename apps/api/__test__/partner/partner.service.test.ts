import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { PartnerService } from "../../src/partner/partner.service";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1, type: "HOSPITAL", name: "서울대병원" }),
  update: jest.fn(),
  createContract: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
  updateContract: jest.fn(),
  findContractById: jest.fn(),
  findExpiringContracts: jest.fn(),
} as any;

const service = new PartnerService(mockRepo);

describe("PartnerService - create", () => {
  beforeEach(() => jest.clearAllMocks());

  test("빈 이름이면 400 에러", async () => {
    await expect(service.create({ type: "HOSPITAL", name: "  " }))
      .rejects.toMatchObject({ code: "PARTNER_NAME_REQUIRED" });
  });

  test("정상 파트너 생성", async () => {
    const result = await service.create({ type: "HOSPITAL", name: "서울대병원" });
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "서울대병원" }));
    expect(result.id).toBe(1);
  });
});

describe("PartnerService - createContract", () => {
  beforeEach(() => jest.clearAllMocks());

  test("종료일이 시작일보다 앞이면 400 에러", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    await expect(service.createContract(1, {
      startDate: "2026-12-01",
      endDate: "2026-01-01",
    })).rejects.toMatchObject({ code: "CONTRACT_END_BEFORE_START" });
  });

  test("정상 계약 생성", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    await service.createContract(1, { startDate: "2026-01-01", endDate: "2027-01-01" });
    expect(mockRepo.createContract).toHaveBeenCalledWith(1, expect.objectContaining({ startDate: "2026-01-01" }));
  });
});

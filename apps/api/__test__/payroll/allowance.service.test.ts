import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { AllowanceService } from "../../src/payroll/allowance/allowance.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
} as any;

const mockSalaryRepo = {
  findById: jest.fn(),
} as any;

const service = new AllowanceService(mockRepo, mockSalaryRepo);

beforeEach(() => jest.clearAllMocks());

describe("AllowanceService.list", () => {
  test("salary 없으면 404를 던진다", async () => {
    mockSalaryRepo.findById.mockResolvedValue(null);
    await expect(service.list(99)).rejects.toMatchObject({
      statusCode: 404,
      code: "SALARY_NOT_FOUND",
    });
  });

  test("salary 있으면 allowances를 반환한다", async () => {
    mockSalaryRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findAll.mockResolvedValue([{ id: 10, name: "식비" }]);
    const result = await service.list(1);
    expect(result).toEqual([{ id: 10, name: "식비" }]);
  });
});

describe("AllowanceService.create", () => {
  test("salary 없으면 404를 던진다", async () => {
    mockSalaryRepo.findById.mockResolvedValue(null);
    await expect(service.create(99, { name: "교통비", amount: 100000 })).rejects.toMatchObject({
      statusCode: 404,
      code: "SALARY_NOT_FOUND",
    });
  });
});

describe("AllowanceService.update", () => {
  test("allowance가 다른 salary 소속이면 404를 던진다", async () => {
    mockSalaryRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findById.mockResolvedValue({ id: 5, staffSalaryId: 99 });
    await expect(service.update(1, 5, { name: "수정" })).rejects.toMatchObject({
      statusCode: 404,
      code: "ALLOWANCE_NOT_FOUND",
    });
  });

  test("allowance 없으면 404를 던진다", async () => {
    mockSalaryRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.update(1, 999, { name: "수정" })).rejects.toMatchObject({
      statusCode: 404,
      code: "ALLOWANCE_NOT_FOUND",
    });
  });
});

describe("AllowanceService.remove", () => {
  test("allowance 없으면 404를 던진다", async () => {
    mockSalaryRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.remove(1, 999)).rejects.toMatchObject({
      statusCode: 404,
      code: "ALLOWANCE_NOT_FOUND",
    });
  });

  test("allowance 있으면 remove 호출", async () => {
    mockSalaryRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.findById.mockResolvedValue({ id: 5, staffSalaryId: 1 });
    mockRepo.remove.mockResolvedValue({ id: 5 });
    await service.remove(1, 5);
    expect(mockRepo.remove).toHaveBeenCalledWith(5);
  });
});

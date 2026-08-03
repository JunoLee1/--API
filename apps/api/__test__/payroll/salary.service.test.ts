import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { SalaryService } from "../../src/payroll/salary/salary.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
} as any;

const service = new SalaryService(mockRepo);

beforeEach(() => jest.clearAllMocks());

describe("SalaryService.get", () => {
  test("존재하지 않으면 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.get(1)).rejects.toMatchObject({
      statusCode: 404,
      code: "SALARY_NOT_FOUND",
    });
  });

  test("존재하면 레코드를 반환한다", async () => {
    const record = { id: 1, baseSalary: 3000000, country: "KR", allowances: [] };
    mockRepo.findById.mockResolvedValue(record);
    await expect(service.get(1)).resolves.toBe(record);
  });
});

describe("SalaryService.update", () => {
  test("존재하지 않으면 404를 던진다", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.update(99, { baseSalary: 4000000 })).rejects.toMatchObject({
      statusCode: 404,
      code: "SALARY_NOT_FOUND",
    });
  });

  test("존재하면 update를 호출한다", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1 });
    mockRepo.update.mockResolvedValue({ id: 1, baseSalary: 4000000 });
    await service.update(1, { baseSalary: 4000000 });
    expect(mockRepo.update).toHaveBeenCalledWith(1, { baseSalary: 4000000 });
  });
});

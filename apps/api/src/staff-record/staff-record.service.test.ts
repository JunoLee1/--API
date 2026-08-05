import { StaffRecordService } from "./staff-record.service";
import { AppError } from "../lib/appError";
import type { StaffRecordRepository } from "./staff-record.repo";

const makeRepo = (overrides: Partial<StaffRecordRepository> = {}): StaffRecordRepository => ({
  findByEmail: jest.fn().mockResolvedValue(null),
  findByEmployeeId: jest.fn().mockResolvedValue(null),
  findById: jest.fn().mockResolvedValue({ id: 1 }),
  create: jest.fn().mockResolvedValue({ id: 1 }),
  terminate: jest.fn().mockResolvedValue({ id: 1, isActive: false, terminatedAt: new Date() }),
  ...overrides,
} as unknown as StaffRecordRepository);

describe("StaffRecordService", () => {
  it("throws 409 when email is duplicated", async () => {
    const repo = makeRepo({ findByEmail: jest.fn().mockResolvedValue({ id: 42 }) });
    const service = new StaffRecordService(repo);
    await expect(service.create({ email: "a@b.com", employeeId: "E1", name: "x" } as any, 1))
      .rejects.toThrow(new AppError(409, "STAFF_ALREADY_EXISTS"));
  });

  it("throws 409 when employeeId is duplicated", async () => {
    const repo = makeRepo({ findByEmployeeId: jest.fn().mockResolvedValue({ id: 42 }) });
    const service = new StaffRecordService(repo);
    await expect(service.create({ email: "new@b.com", employeeId: "E1", name: "x" } as any, 1))
      .rejects.toThrow(new AppError(409, "STAFF_ALREADY_EXISTS"));
  });

  it("terminate sets terminatedAt and isActive: false", async () => {
    const terminate = jest.fn().mockResolvedValue({ id: 1, isActive: false, terminatedAt: new Date() });
    const repo = makeRepo({ terminate });
    const service = new StaffRecordService(repo);
    const result = await service.terminate(1);
    expect(terminate).toHaveBeenCalledWith(1, expect.any(Date));
    expect(result.isActive).toBe(false);
    expect(result.terminatedAt).toBeInstanceOf(Date);
  });
});

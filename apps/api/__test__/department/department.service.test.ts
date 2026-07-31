import { describe, test, jest, expect, beforeEach } from "@jest/globals";
import { DepartmentService } from "../../src/department/department.service";
import { AppError } from "../../src/lib/appError";

const mockRepo = {
  findAll: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findById: jest.fn(),
  findByName: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as any;

const service = new DepartmentService(mockRepo);

describe("DepartmentService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("list: 전체 부서 목록 반환", async () => {
    mockRepo.findAll.mockResolvedValue([{ id: 1, name: "전략팀", isActive: true }]);
    const result = await service.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "전략팀" });
  });

  test("get: 존재하는 부서 반환", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, name: "전략팀", isActive: true });
    const result = await service.get(1);
    expect(result.id).toBe(1);
  });

  test("get: 존재하지 않으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.get(99)).rejects.toThrow(AppError);
    await expect(service.get(99)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("create: 정상 생성", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ id: 2, name: "마케팅팀", isActive: true });
    const result = await service.create({ name: "마케팅팀" });
    expect(result.name).toBe("마케팅팀");
    expect(mockRepo.create).toHaveBeenCalledWith({ name: "마케팅팀" });
  });

  test("create: 중복 이름이면 409", async () => {
    mockRepo.findByName.mockResolvedValue({ id: 1, name: "전략팀" });
    await expect(service.create({ name: "전략팀" })).rejects.toMatchObject({ statusCode: 409 });
  });

  test("update: 존재하는 부서 수정", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, name: "전략팀", isActive: true });
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue({ id: 1, name: "전략기획팀", isActive: true });
    const result = await service.update(1, { name: "전략기획팀" });
    expect(result.name).toBe("전략기획팀");
  });

  test("update: 존재하지 않으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.update(99, { name: "X" })).rejects.toMatchObject({ statusCode: 404 });
  });

  test("delete: 정상 삭제", async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, name: "전략팀", isActive: true });
    await service.delete(1);
    expect(mockRepo.delete).toHaveBeenCalledWith(1);
  });

  test("delete: 존재하지 않으면 404", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.delete(99)).rejects.toMatchObject({ statusCode: 404 });
  });
});

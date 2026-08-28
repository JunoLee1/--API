import { OnboardingTemplateService } from "../../src/onboarding-template/onboarding-template.service";
import { AppError } from "../../src/lib/appError";
import type { OnboardingTemplateRepository } from "../../src/onboarding-template/onboarding-template.repo";
import type { PrismaClient } from "../../src/generated/client";

jest.mock("../../src/lib/auditLog", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

const DEPT_ID = 10;
const ACTOR_ID = 100;

const makeTemplate = (overrides: Partial<any> = {}) => ({
  id: 1,
  departmentId: DEPT_ID,
  name: "개발팀 온보딩",
  tasks: [],
  createdById: ACTOR_ID,
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: ACTOR_ID, username: "hr", nickname: "HR" },
  updatedBy: null,
  ...overrides,
});

const makeRepo = (overrides: Partial<OnboardingTemplateRepository> = {}): OnboardingTemplateRepository =>
  ({
    findByDepartmentId: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockImplementation(async (deptId: number, data: any) =>
      makeTemplate({
        departmentId: deptId,
        name: data.name,
        tasks: data.tasks,
        createdById: data.actorId,
      }),
    ),
    remove: jest.fn().mockImplementation(async () => makeTemplate()),
    ...overrides,
  } as unknown as OnboardingTemplateRepository);

const makePrisma = (overrides: any = {}): PrismaClient =>
  ({
    department: {
      findUnique: jest.fn().mockResolvedValue({ id: DEPT_ID }),
    },
    ...overrides,
  } as unknown as PrismaClient);

const makeService = (repo = makeRepo(), prisma = makePrisma()) =>
  new OnboardingTemplateService(repo, prisma);

// ────────────────────────────────────────────
// upsert
// ────────────────────────────────────────────

describe("OnboardingTemplateService.upsert", () => {
  it("creates new template when none exists", async () => {
    const repo = makeRepo();
    const result = await makeService(repo).upsert(
      DEPT_ID,
      { name: "개발팀 온보딩", tasks: [{ title: "환영 오리엔테이션" }] },
      ACTOR_ID,
    );
    expect(result.departmentId).toBe(DEPT_ID);
    expect(repo.upsert).toHaveBeenCalledWith(
      DEPT_ID,
      expect.objectContaining({
        name: "개발팀 온보딩",
        actorId: ACTOR_ID,
        tasks: [
          expect.objectContaining({ title: "환영 오리엔테이션", requiresVerification: false, optional: false }),
        ],
      }),
    );
  });

  it("trims name and rejects empty", async () => {
    await expect(
      makeService().upsert(DEPT_ID, { name: "   ", tasks: [] }, ACTOR_ID),
    ).rejects.toThrow(new AppError(400, "NAME_REQUIRED"));
  });

  it("trims task title and rejects empty title", async () => {
    await expect(
      makeService().upsert(
        DEPT_ID,
        { name: "온보딩", tasks: [{ title: "   " } as any] },
        ACTOR_ID,
      ),
    ).rejects.toThrow(/TASK_TITLE_REQUIRED_AT:0/);
  });

  it("throws NAME_TOO_LONG when name > 200 chars", async () => {
    await expect(
      makeService().upsert(DEPT_ID, { name: "x".repeat(201), tasks: [] }, ACTOR_ID),
    ).rejects.toThrow(new AppError(400, "NAME_TOO_LONG"));
  });

  it("throws TOO_MANY_TASKS when > 100 tasks", async () => {
    const tasks = Array.from({ length: 101 }, (_, i) => ({ title: `T${i}` }));
    await expect(
      makeService().upsert(DEPT_ID, { name: "T", tasks } as any, ACTOR_ID),
    ).rejects.toThrow(new AppError(400, "TOO_MANY_TASKS"));
  });

  it("throws TASKS_MUST_BE_ARRAY when tasks is not an array", async () => {
    await expect(
      makeService().upsert(DEPT_ID, { name: "T", tasks: {} as any }, ACTOR_ID),
    ).rejects.toThrow(new AppError(400, "TASKS_MUST_BE_ARRAY"));
  });

  it("throws DEPARTMENT_NOT_FOUND when department missing", async () => {
    const prisma = makePrisma({
      department: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      makeService(makeRepo(), prisma).upsert(
        DEPT_ID,
        { name: "T", tasks: [] },
        ACTOR_ID,
      ),
    ).rejects.toThrow(new AppError(404, "DEPARTMENT_NOT_FOUND"));
  });

  it("validates dueDaysFromStart range (0..365)", async () => {
    await expect(
      makeService().upsert(
        DEPT_ID,
        { name: "T", tasks: [{ title: "t", dueDaysFromStart: -1 } as any] },
        ACTOR_ID,
      ),
    ).rejects.toThrow(/INVALID_DUE_DAYS_AT:0/);
    await expect(
      makeService().upsert(
        DEPT_ID,
        { name: "T", tasks: [{ title: "t", dueDaysFromStart: 366 } as any] },
        ACTOR_ID,
      ),
    ).rejects.toThrow(/INVALID_DUE_DAYS_AT:0/);
    await expect(
      makeService().upsert(
        DEPT_ID,
        { name: "T", tasks: [{ title: "t", dueDaysFromStart: 3.5 } as any] },
        ACTOR_ID,
      ),
    ).rejects.toThrow(/INVALID_DUE_DAYS_AT:0/);
  });

  it("trims and preserves description; defaults verify/optional to false", async () => {
    const repo = makeRepo();
    await makeService(repo).upsert(
      DEPT_ID,
      {
        name: "T",
        tasks: [
          { title: " 오리엔테이션 ", description: " 첫날 안내 " },
        ] as any,
      },
      ACTOR_ID,
    );
    expect(repo.upsert).toHaveBeenCalledWith(
      DEPT_ID,
      expect.objectContaining({
        tasks: [
          {
            title: "오리엔테이션",
            description: "첫날 안내",
            requiresVerification: false,
            optional: false,
          },
        ],
      }),
    );
  });

  it("passes through valid task fields", async () => {
    const repo = makeRepo();
    await makeService(repo).upsert(
      DEPT_ID,
      {
        name: "T",
        tasks: [
          {
            title: "장비 수령",
            dueDaysFromStart: 3,
            requiresVerification: true,
            optional: false,
          },
        ],
      },
      ACTOR_ID,
    );
    expect(repo.upsert).toHaveBeenCalledWith(
      DEPT_ID,
      expect.objectContaining({
        tasks: [
          {
            title: "장비 수령",
            dueDaysFromStart: 3,
            requiresVerification: true,
            optional: false,
          },
        ],
      }),
    );
  });
});

// ────────────────────────────────────────────
// get / remove
// ────────────────────────────────────────────

describe("OnboardingTemplateService.get", () => {
  it("delegates to repo.findByDepartmentId", async () => {
    const template = makeTemplate();
    const repo = makeRepo({ findByDepartmentId: jest.fn().mockResolvedValue(template) });
    const result = await makeService(repo).get(DEPT_ID);
    expect(result).toBe(template);
    expect(repo.findByDepartmentId).toHaveBeenCalledWith(DEPT_ID);
  });
});

describe("OnboardingTemplateService.remove", () => {
  it("removes when template exists", async () => {
    const template = makeTemplate();
    const repo = makeRepo({ findByDepartmentId: jest.fn().mockResolvedValue(template) });
    const result = await makeService(repo).remove(DEPT_ID, ACTOR_ID);
    expect(result.id).toBe(1);
    expect(repo.remove).toHaveBeenCalledWith(DEPT_ID);
  });

  it("throws TEMPLATE_NOT_FOUND when template missing", async () => {
    const repo = makeRepo({ findByDepartmentId: jest.fn().mockResolvedValue(null) });
    await expect(makeService(repo).remove(DEPT_ID, ACTOR_ID)).rejects.toThrow(
      new AppError(404, "TEMPLATE_NOT_FOUND"),
    );
  });
});

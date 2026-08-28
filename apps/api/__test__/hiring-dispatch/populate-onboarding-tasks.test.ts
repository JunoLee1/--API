import { populateOnboardingTasks } from "../../src/hiring-dispatch/populate-onboarding-tasks";
import type { Prisma } from "../../src/generated/client";

const ONBOARDING_ID = 999;
const DEPT_ID = 10;
const START_DATE = new Date("2026-09-01T00:00:00.000Z");

const makeTx = (templateTasks: unknown, hasTemplate = true) => {
  const findUnique = jest.fn().mockResolvedValue(
    hasTemplate ? { tasks: templateTasks } : null,
  );
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  return {
    tx: {
      onboardingTemplate: { findUnique },
      onboardingTask: { createMany },
    } as unknown as Prisma.TransactionClient,
    findUnique,
    createMany,
  };
};

describe("populateOnboardingTasks", () => {
  it("no-op when department has no template", async () => {
    const { tx, createMany } = makeTx(null, false);
    await populateOnboardingTasks(tx, ONBOARDING_ID, DEPT_ID, START_DATE);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("no-op when template.tasks is empty array", async () => {
    const { tx, createMany } = makeTx([]);
    await populateOnboardingTasks(tx, ONBOARDING_ID, DEPT_ID, START_DATE);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("no-op when template.tasks is a non-array (corrupted JSON) — silently skips", async () => {
    const { tx, createMany } = makeTx({ not: "an array" });
    await populateOnboardingTasks(tx, ONBOARDING_ID, DEPT_ID, START_DATE);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("populates OnboardingTask rows preserving order + defaults", async () => {
    const templateTasks = [
      { title: "환영 오리엔테이션" },
      {
        title: "장비 수령",
        description: "노트북 + 배지",
        dueDaysFromStart: 3,
        requiresVerification: true,
        optional: false,
      },
      { title: "회식", optional: true },
    ];
    const { tx, createMany } = makeTx(templateTasks);
    await populateOnboardingTasks(tx, ONBOARDING_ID, DEPT_ID, START_DATE);
    expect(createMany).toHaveBeenCalledTimes(1);
    const call = createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(3);
    expect(call.data[0]).toEqual(
      expect.objectContaining({
        onboardingId: ONBOARDING_ID,
        title: "환영 오리엔테이션",
        description: null,
        dueDate: null,
        requiresVerification: false,
        optional: false,
        order: 0,
      }),
    );
    expect(call.data[1]).toEqual(
      expect.objectContaining({
        onboardingId: ONBOARDING_ID,
        title: "장비 수령",
        description: "노트북 + 배지",
        // startDate 2026-09-01 + 3 days = 2026-09-04
        dueDate: new Date("2026-09-04T00:00:00.000Z"),
        requiresVerification: true,
        optional: false,
        order: 1,
      }),
    );
    expect(call.data[2]).toEqual(
      expect.objectContaining({
        onboardingId: ONBOARDING_ID,
        title: "회식",
        requiresVerification: false,
        optional: true,
        order: 2,
      }),
    );
  });

  it("computes dueDate = startDate + dueDaysFromStart when set", async () => {
    const { tx, createMany } = makeTx([{ title: "t", dueDaysFromStart: 7 }]);
    await populateOnboardingTasks(tx, ONBOARDING_ID, DEPT_ID, START_DATE);
    const call = createMany.mock.calls[0][0];
    expect(call.data[0].dueDate).toEqual(new Date("2026-09-08T00:00:00.000Z"));
  });

  it("leaves dueDate null when dueDaysFromStart absent", async () => {
    const { tx, createMany } = makeTx([{ title: "t" }]);
    await populateOnboardingTasks(tx, ONBOARDING_ID, DEPT_ID, START_DATE);
    const call = createMany.mock.calls[0][0];
    expect(call.data[0].dueDate).toBeNull();
  });

  it("looks up template by departmentId", async () => {
    const { tx, findUnique } = makeTx([]);
    await populateOnboardingTasks(tx, ONBOARDING_ID, DEPT_ID, START_DATE);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { departmentId: DEPT_ID } }),
    );
  });
});

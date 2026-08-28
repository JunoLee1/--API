import { describe, it, expect, jest } from "@jest/globals";
import { runProbationReviewNotifier } from "../../src/jobs/probationReviewNotifier";

// Helpers to build a date exactly N days from `today` at noon so we're
// timezone-safe (both boundaries fall in the same UTC day for any TZ ≤ 12h).
const addMonths = (d: Date, m: number) => {
  const out = new Date(d);
  out.setMonth(out.getMonth() + m);
  return out;
};
const addDays = (d: Date, n: number) => {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
};

const DEPT_HEAD_ID = 20;

describe("runProbationReviewNotifier", () => {
  it("fires D-7 for a staff whose 3MO checkpoint lands in 7 days", async () => {
    const today = new Date("2026-08-28T12:00:00Z");
    // probationStartedAt so that today + 7 = today + 3 months
    // => probationStartedAt = (today + 7) - 3 months
    const threeMoTarget = addDays(today, 7);
    const probationStartedAt = addMonths(threeMoTarget, -3);

    const findStaffInProbation = jest.fn<any>().mockResolvedValue([
      {
        id: 1,
        name: "김직원",
        probationStartedAt,
        departmentId: 40,
        department: { id: 40, name: "분석팀", headId: DEPT_HEAD_ID },
      },
    ]);
    const hasSentReminder = jest.fn<any>().mockResolvedValue(false);
    const notifyDeptHead = jest.fn<any>().mockResolvedValue(undefined);

    await runProbationReviewNotifier({
      findStaffInProbation,
      hasSentReminder,
      notifyDeptHead,
      probationMonths: 3,
      now: () => today,
    });

    expect(notifyDeptHead).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: 1, reviewType: "THREE_MO", deptHeadId: DEPT_HEAD_ID }),
    );
  });

  it("fires D-7 for a staff whose 6MO checkpoint lands in 7 days", async () => {
    const today = new Date("2026-08-28T12:00:00Z");
    const sixMoTarget = addDays(today, 7);
    const probationStartedAt = addMonths(sixMoTarget, -6);

    const findStaffInProbation = jest.fn<any>().mockResolvedValue([
      {
        id: 2,
        name: "박직원",
        probationStartedAt,
        departmentId: 40,
        department: { id: 40, name: "분석팀", headId: DEPT_HEAD_ID },
      },
    ]);
    const hasSentReminder = jest.fn<any>().mockResolvedValue(false);
    const notifyDeptHead = jest.fn<any>().mockResolvedValue(undefined);

    await runProbationReviewNotifier({
      findStaffInProbation,
      hasSentReminder,
      notifyDeptHead,
      probationMonths: 3,
      now: () => today,
    });

    expect(notifyDeptHead).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: 2, reviewType: "SIX_MO", deptHeadId: DEPT_HEAD_ID }),
    );
  });

  it("does NOT fire when D+/-8 or later (only exactly D-7)", async () => {
    const today = new Date("2026-08-28T12:00:00Z");
    // 3MO checkpoint is 10 days out — outside the D-7 window
    const threeMoTarget = addDays(today, 10);
    const probationStartedAt = addMonths(threeMoTarget, -3);

    const findStaffInProbation = jest.fn<any>().mockResolvedValue([
      {
        id: 3,
        probationStartedAt,
        departmentId: 40,
        department: { id: 40, name: "분석팀", headId: DEPT_HEAD_ID },
      },
    ]);
    const notifyDeptHead = jest.fn<any>().mockResolvedValue(undefined);

    await runProbationReviewNotifier({
      findStaffInProbation,
      hasSentReminder: jest.fn<any>().mockResolvedValue(false),
      notifyDeptHead,
      probationMonths: 3,
      now: () => today,
    });

    expect(notifyDeptHead).not.toHaveBeenCalled();
  });

  it("deduplicates when hasSentReminder returns true", async () => {
    const today = new Date("2026-08-28T12:00:00Z");
    const threeMoTarget = addDays(today, 7);
    const probationStartedAt = addMonths(threeMoTarget, -3);

    const findStaffInProbation = jest.fn<any>().mockResolvedValue([
      {
        id: 4,
        probationStartedAt,
        departmentId: 40,
        department: { id: 40, name: "분석팀", headId: DEPT_HEAD_ID },
      },
    ]);
    const hasSentReminder = jest.fn<any>().mockResolvedValue(true);
    const notifyDeptHead = jest.fn<any>().mockResolvedValue(undefined);

    await runProbationReviewNotifier({
      findStaffInProbation,
      hasSentReminder,
      notifyDeptHead,
      probationMonths: 3,
      now: () => today,
    });

    expect(notifyDeptHead).not.toHaveBeenCalled();
  });

  it("skips staff without a department head (headless dept)", async () => {
    const today = new Date("2026-08-28T12:00:00Z");
    const threeMoTarget = addDays(today, 7);
    const probationStartedAt = addMonths(threeMoTarget, -3);

    const findStaffInProbation = jest.fn<any>().mockResolvedValue([
      {
        id: 5,
        probationStartedAt,
        departmentId: 40,
        department: { id: 40, name: "고아팀", headId: null },
      },
    ]);
    const notifyDeptHead = jest.fn<any>().mockResolvedValue(undefined);

    await runProbationReviewNotifier({
      findStaffInProbation,
      hasSentReminder: jest.fn<any>().mockResolvedValue(false),
      notifyDeptHead,
      probationMonths: 3,
      now: () => today,
    });

    expect(notifyDeptHead).not.toHaveBeenCalled();
  });

  it("skips staff without probationStartedAt", async () => {
    const today = new Date("2026-08-28T12:00:00Z");
    const findStaffInProbation = jest.fn<any>().mockResolvedValue([
      {
        id: 6,
        probationStartedAt: null,
        departmentId: 40,
        department: { id: 40, name: "분석팀", headId: DEPT_HEAD_ID },
      },
    ]);
    const notifyDeptHead = jest.fn<any>().mockResolvedValue(undefined);

    await runProbationReviewNotifier({
      findStaffInProbation,
      hasSentReminder: jest.fn<any>().mockResolvedValue(false),
      notifyDeptHead,
      probationMonths: 3,
      now: () => today,
    });

    expect(notifyDeptHead).not.toHaveBeenCalled();
  });
});

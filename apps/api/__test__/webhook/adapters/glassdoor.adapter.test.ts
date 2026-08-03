import { describe, test, expect } from "@jest/globals";
import { GlassdoorAdapter } from "../../../src/webhook/adapters/glassdoor.adapter";

const adapter = new GlassdoorAdapter();

describe("GlassdoorAdapter", () => {
  test("정상 payload를 정규화한다", () => {
    const payload = {
      jobId: "gd-job-1",
      applicantId: "gd-app-1",
      fullName: "Hong Gil Dong",
      email: "hong@example.com",
      phoneNumber: "010-1234-5678",
      resumeLink: "https://glassdoor.com/resume/1",
    };
    expect(adapter.normalize(payload)).toEqual({
      externalJobId: "gd-job-1",
      externalApplicantId: "gd-app-1",
      applicantName: "Hong Gil Dong",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resumeUrl: "https://glassdoor.com/resume/1",
    });
  });

  test("필수 필드 누락 시 INVALID_PAYLOAD 에러를 던진다", () => {
    expect(() => adapter.normalize({ jobId: "x" })).toThrow("INVALID_PAYLOAD");
  });
});

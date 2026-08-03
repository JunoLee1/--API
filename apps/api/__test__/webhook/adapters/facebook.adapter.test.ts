import { describe, test, expect } from "@jest/globals";
import { FacebookAdapter } from "../../../src/webhook/adapters/facebook.adapter";

const adapter = new FacebookAdapter();

describe("FacebookAdapter", () => {
  test("정상 payload를 정규화한다", () => {
    const payload = {
      job_opening_id: "fb-job-1",
      applicant_id: "fb-app-1",
      full_name: "Hong Gil Dong",
      email: "hong@example.com",
      phone_number: "010-1234-5678",
      resume_url: "https://facebook.com/resume/1",
    };
    expect(adapter.normalize(payload)).toEqual({
      externalJobId: "fb-job-1",
      externalApplicantId: "fb-app-1",
      applicantName: "Hong Gil Dong",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resumeUrl: "https://facebook.com/resume/1",
    });
  });

  test("필수 필드 누락 시 INVALID_PAYLOAD 에러를 던진다", () => {
    expect(() => adapter.normalize({ job_opening_id: "x" })).toThrow("INVALID_PAYLOAD");
  });
});

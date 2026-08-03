import { describe, test, expect } from "@jest/globals";
import { SaraminAdapter } from "../../../src/webhook/adapters/saramin.adapter";

const adapter = new SaraminAdapter();

describe("SaraminAdapter", () => {
  test("정상 payload를 정규화한다", () => {
    const payload = {
      job_id: "saramin-job-1",
      applicant_id: "saramin-app-1",
      name: "홍길동",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resume_url: "https://saramin.co.kr/resume/1",
    };
    expect(adapter.normalize(payload)).toEqual({
      externalJobId: "saramin-job-1",
      externalApplicantId: "saramin-app-1",
      applicantName: "홍길동",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resumeUrl: "https://saramin.co.kr/resume/1",
    });
  });

  test("필수 필드 누락 시 INVALID_PAYLOAD 에러를 던진다", () => {
    expect(() => adapter.normalize({ job_id: "x" })).toThrow("INVALID_PAYLOAD");
  });
});

import { describe, test, expect } from "@jest/globals";
import { IndeedAdapter } from "../../../src/webhook/adapters/indeed.adapter";

const adapter = new IndeedAdapter();

describe("IndeedAdapter", () => {
  test("정상 payload를 정규화한다", () => {
    const payload = {
      jobKey: "indeed-job-1",
      candidateId: "indeed-cand-1",
      candidate: {
        fullName: "Hong Gil Dong",
        emailAddress: "hong@example.com",
        phoneNumber: "010-1234-5678",
      },
      resumeUrl: "https://indeed.com/resume/1",
    };
    expect(adapter.normalize(payload)).toEqual({
      externalJobId: "indeed-job-1",
      externalApplicantId: "indeed-cand-1",
      applicantName: "Hong Gil Dong",
      email: "hong@example.com",
      phone: "010-1234-5678",
      resumeUrl: "https://indeed.com/resume/1",
    });
  });

  test("필수 필드 누락 시 INVALID_PAYLOAD 에러를 던진다", () => {
    expect(() => adapter.normalize({ jobKey: "x" })).toThrow("INVALID_PAYLOAD");
  });
});

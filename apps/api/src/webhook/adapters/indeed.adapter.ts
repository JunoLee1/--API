import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class IndeedAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    const candidate = p.candidate as Record<string, unknown> | undefined;
    if (!p.jobKey || !p.candidateId || !candidate?.fullName || !candidate?.emailAddress) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    const result: NormalizedApplication = {
      externalJobId: String(p.jobKey),
      externalApplicantId: String(p.candidateId),
      applicantName: String(candidate.fullName),
      email: String(candidate.emailAddress),
    };
    if (candidate.phoneNumber) result.phone = String(candidate.phoneNumber);
    if (p.resumeUrl) result.resumeUrl = String(p.resumeUrl);
    return result;
  }
}

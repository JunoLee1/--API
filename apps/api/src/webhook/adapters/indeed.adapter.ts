import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class IndeedAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    const candidate = p.candidate as Record<string, unknown> | undefined;
    if (!p.jobKey || !p.candidateId || !candidate?.fullName || !candidate?.emailAddress) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    return {
      externalJobId: String(p.jobKey),
      externalApplicantId: String(p.candidateId),
      applicantName: String(candidate.fullName),
      email: String(candidate.emailAddress),
      ...(candidate.phoneNumber && { phone: String(candidate.phoneNumber) }),
      ...(p.resumeUrl && { resumeUrl: String(p.resumeUrl) }),
    };
  }
}

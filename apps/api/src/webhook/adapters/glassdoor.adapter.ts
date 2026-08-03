import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class GlassdoorAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    if (!p.jobId || !p.applicantId || !p.fullName || !p.email) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    const result: NormalizedApplication = {
      externalJobId: String(p.jobId),
      externalApplicantId: String(p.applicantId),
      applicantName: String(p.fullName),
      email: String(p.email),
    };
    if (p.phoneNumber) result.phone = String(p.phoneNumber);
    if (p.resumeLink) result.resumeUrl = String(p.resumeLink);
    return result;
  }
}

import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class SaraminAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    if (!p.job_id || !p.applicant_id || !p.name || !p.email) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    const result: NormalizedApplication = {
      externalJobId: String(p.job_id),
      externalApplicantId: String(p.applicant_id),
      applicantName: String(p.name),
      email: String(p.email),
    };
    if (p.phone) result.phone = String(p.phone);
    if (p.resume_url) result.resumeUrl = String(p.resume_url);
    return result;
  }
}

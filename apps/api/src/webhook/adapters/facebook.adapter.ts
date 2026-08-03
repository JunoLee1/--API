import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class FacebookAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    if (!p.job_opening_id || !p.applicant_id || !p.full_name || !p.email) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    const result: NormalizedApplication = {
      externalJobId: String(p.job_opening_id),
      externalApplicantId: String(p.applicant_id),
      applicantName: String(p.full_name),
      email: String(p.email),
    };
    if (p.phone_number) result.phone = String(p.phone_number);
    if (p.resume_url) result.resumeUrl = String(p.resume_url);
    return result;
  }
}

import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class FacebookAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    if (!p.job_opening_id || !p.applicant_id || !p.full_name || !p.email) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    return {
      externalJobId: String(p.job_opening_id),
      externalApplicantId: String(p.applicant_id),
      applicantName: String(p.full_name),
      email: String(p.email),
      ...(p.phone_number && { phone: String(p.phone_number) }),
      ...(p.resume_url && { resumeUrl: String(p.resume_url) }),
    };
  }
}

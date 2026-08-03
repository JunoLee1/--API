import { AppError } from "../../lib/appError";
import type { NormalizedApplication, WebhookAdapter } from "./types";

export class SaraminAdapter implements WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication {
    const p = payload as Record<string, unknown>;
    if (!p.job_id || !p.applicant_id || !p.name || !p.email) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    return {
      externalJobId: String(p.job_id),
      externalApplicantId: String(p.applicant_id),
      applicantName: String(p.name),
      email: String(p.email),
      ...(p.phone && { phone: String(p.phone) }),
      ...(p.resume_url && { resumeUrl: String(p.resume_url) }),
    };
  }
}

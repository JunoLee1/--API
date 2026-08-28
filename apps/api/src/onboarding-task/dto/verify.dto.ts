/**
 * PATCH /onboarding-tasks/:id/verify
 *
 * APPROVE: SELF_REPORTED → DONE (verifier records verifiedAt + optional notes).
 * REJECT:  SELF_REPORTED → PENDING (verifyNotes REQUIRED — reasoning surfaces
 *          back to the trainee via ONBOARDING_TASK_REJECTED notif).
 *
 * Self-verify is blocked in the service layer (403 CANNOT_SELF_VERIFY) — a
 * trainee cannot mark their own SELF_REPORTED task DONE.
 */
export interface VerifyOnboardingTaskDto {
  action: "APPROVE" | "REJECT";
  verifyNotes?: string;
}

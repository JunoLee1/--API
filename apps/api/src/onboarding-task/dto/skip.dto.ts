/**
 * PATCH /onboarding-tasks/:id/skip
 *
 * Only permitted for `optional === true` tasks, PENDING or SELF_REPORTED
 * (never DONE / already SKIPPED — service throws ALREADY_TERMINAL).
 * `skipReason` is required non-empty (trimmed) so the audit trail always
 * records intent.
 *
 * Actor may be the trainee (self-skip) or an HR/dept.head (skip on trainee's
 * behalf — e.g. legacy-hire waiver). The service layer applies the role gate.
 */
export interface SkipOnboardingTaskDto {
  skipReason: string;
}

/**
 * Single task inside the Department 1:1 template. Snapshot-populated into
 * OnboardingTask at dispatch() time (populate-onboarding-tasks.ts).
 *
 * `dueDaysFromStart` is optional — when set, the populate helper computes
 * dueDate = startDate + N days. When null, the task has no deadline.
 */
export interface OnboardingTemplateTask {
  title: string;
  description?: string;
  dueDaysFromStart?: number;
  requiresVerification?: boolean;
  optional?: boolean;
}

/**
 * PUT /onboarding-templates/:departmentId
 *
 * Upsert-shaped — same body creates or replaces the entire template. Kept
 * intentionally coarse (Department 1:1) so a version-control-style history
 * isn't needed at MVP; the plan defers per-role differentiation and
 * versioning as separate follow-ups (Q2, non-goals).
 */
export interface UpsertOnboardingTemplateDto {
  name: string;
  tasks: OnboardingTemplateTask[];
}

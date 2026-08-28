export type ProbationReviewTypeDto = "THREE_MO" | "SIX_MO";
export type ProbationReviewStatusDto = "PENDING" | "PASSED" | "FAILED";

/**
 * Body for POST /staff-records/:id/probation-review — 부서장이 review 를 제출한다.
 *
 * Rules (see ProbationReviewService.submit):
 *   - reviewType uniquely identifies a review row per (staffRecord, type)
 *   - status must be PASSED | FAILED (PENDING isn't a submittable outcome)
 *   - leaderAssessment is required when status ∈ {PASSED, FAILED}
 *   - a SIX_MO PASSED / any FAILED transitions StaffRecord.probationStatus
 */
export interface SubmitProbationReviewDto {
  reviewType: ProbationReviewTypeDto;
  status: Exclude<ProbationReviewStatusDto, "PENDING">;
  leaderAssessment: string;
}

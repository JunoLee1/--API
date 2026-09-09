-- AlterEnum
BEGIN;
CREATE TYPE "public"."PartnerType_new" AS ENUM ('MANUFACTURER', 'HOSPITAL');
ALTER TABLE "public"."Partner" ALTER COLUMN "type" TYPE "public"."PartnerType_new" USING ("type"::text::"public"."PartnerType_new");
ALTER TYPE "public"."PartnerType" RENAME TO "PartnerType_old";
ALTER TYPE "public"."PartnerType_new" RENAME TO "PartnerType";
DROP TYPE "PartnerType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."AttendanceStatus_new" AS ENUM ('PRESENT', 'ABSENT_UNAUTHORIZED', 'LATE_UNAUTHORIZED', 'ABSENT_AUTHORIZED');
ALTER TABLE "public"."AttendanceAppeal" ALTER COLUMN "originalStatus" TYPE "public"."AttendanceStatus_new" USING ("originalStatus"::text::"public"."AttendanceStatus_new");
ALTER TABLE "public"."AttendanceAppeal" ALTER COLUMN "requestedStatus" TYPE "public"."AttendanceStatus_new" USING ("requestedStatus"::text::"public"."AttendanceStatus_new");
ALTER TABLE "public"."TrainingResult" ALTER COLUMN "attendance" TYPE "public"."AttendanceStatus_new" USING ("attendance"::text::"public"."AttendanceStatus_new");
ALTER TYPE "public"."AttendanceStatus" RENAME TO "AttendanceStatus_old";
ALTER TYPE "public"."AttendanceStatus_new" RENAME TO "AttendanceStatus";
DROP TYPE "AttendanceStatus_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."NotificationType_new" AS ENUM ('CONTRACT_EXPIRY', 'PERFORMANCE_BONUS_ACHIEVED', 'INJURY_OCCURRED', 'INJURY_READY_TO_RETURN', 'INJURY_RETURNED', 'SQUAD_DEPTH_LOW', 'TRAINING_ATTENDANCE_WARNING', 'EQUIPMENT_LOW_STOCK', 'EXTENSION_OPTION_AVAILABLE', 'EXTERNAL_REPORT_CREATED', 'EXTERNAL_REPORT_DUE_SOON', 'EXTERNAL_REPORT_OVERDUE', 'MEDICAL_EXPENSE_SUBMITTED', 'MEDICAL_EXPENSE_LEADER_APPROVED', 'MEDICAL_EXPENSE_REJECTED', 'MEDICAL_EXPENSE_APPROVED', 'REPORT_SUBMITTED', 'REPORT_REJECTED', 'COACH_AUTO_SHORTLISTED', 'COACH_MANUALLY_SHORTLISTED', 'COACH_SHORTLISTED', 'COACH_APPROVAL_REQUESTED', 'COACH_APPROVAL_PENDING', 'COACH_CONTRACTED', 'COACH_HEAD_CONTRACTED', 'COACH_ARCHIVED', 'COACH_TUTOR_SUPPORT_NEEDED', 'TRAINING_LOAD_ALERT', 'PLAYER_DEVELOPMENT_PLAN_ACTIVATED', 'PLAYER_CONTRACT_SIGNED', 'ATTENDANCE_PENALTY', 'TRAINING_SESSION_PENDING', 'VIDEO_ASSIGNED', 'VIDEO_ASSIGNMENT_OVERDUE', 'WORK_PERMIT_EXPIRY_SOON', 'CALLUP_REQUESTED', 'CALLUP_APPROVED', 'CALLUP_REJECTED', 'CALLUP_DOCS_READY', 'LOAN_OUT_EXPIRED', 'TACTICAL_ANALYSIS_CONFIRM_REQUESTED', 'JERSEY_NUMBER_CONFLICT', 'MATCH_DAY_REMINDER', 'ATTENDANCE_UNAUTHORIZED', 'ATTENDANCE_PENALTY_PLAYER', 'YOUTH_REGISTRATION_STATUS_CHANGED', 'YOUTH_WEEKLY_SCHEDULE', 'YOUTH_SESSION_CHANGED', 'GUARDIAN_CHILD_INJURY', 'GUARDIAN_CHILD_CALLUP', 'INCIDENT_REPORT_SUBMITTED', 'GROWTH_REPORT_PUBLISHED', 'SAFEGUARD_EMERGENCY', 'FEE_INVOICE_ISSUED', 'FEE_REMINDER', 'FEE_OVERDUE_WARNING', 'FEE_ACCOUNT_LOCKED', 'FACILITY_EMERGENCY', 'FACILITY_MAINTENANCE_RESOLVED', 'PAYROLL_CONFIRMED', 'JOB_POSTING_DRAFT_CREATED', 'PAYROLL_SECOND_APPROVED', 'IT_ASSET_EXPIRY_SOON', 'IT_ASSET_RETIREMENT_SYNC', 'INVENTORY_LOW_STOCK', 'FINANCE_SUBMIT_REQUIRED', 'SALES_NEGATIVE_VALUE', 'LICENSE_SEAT_EXCEEDED', 'CONTRACT_EXPIRY_90D', 'CONTRACT_EXPIRY_60D', 'CONTRACT_EXPIRY_30D', 'SPONSORSHIP_EXPIRY_90D', 'SPONSORSHIP_EXPIRY_60D', 'SPONSORSHIP_EXPIRY_30D', 'EQUIPMENT_INSPECTION_DUE', 'HIRING_SURVEY_OPEN', 'HIRING_SURVEY_DEADLINE_REMINDER', 'HIRING_SURVEY_CLOSED', 'HIRING_PLAN_APPROVED', 'WORK_PERMIT_EXPIRY_SOON_60D', 'INJURY_REHABILITATING_STARTED', 'INJURY_REPORT_UPDATED', 'TRAINING_HIGH_PERFORMANCE_PLAYER', 'TRAINING_HIGH_PERFORMANCE_SELF', 'ASSET_REQUEST_SUBMITTED', 'ASSET_REQUEST_LEADER_APPROVED', 'ASSET_REQUEST_LEADER_REJECTED', 'ASSET_REQUEST_APPROVED', 'ASSET_REQUEST_REJECTED', 'ASSET_REQUEST_FULFILLED', 'HIRING_SURVEY_ALL_RESPONDED', 'HIRING_DISPATCH_CREATED', 'HIRING_DISPATCH_BUDGET_REVERIFIED', 'HIRING_DISPATCH_DISPATCH_APPROVED', 'HIRING_DISPATCH_DISPATCHED', 'HIRING_DISPATCH_REJECTED', 'HIRING_DISPATCH_CANCELLED', 'HIRING_DISPATCH_PERMISSION_REQUESTED', 'MEDICAL_EQUIPMENT_LOAN_REQUESTED', 'MEDICAL_EQUIPMENT_LOAN_APPROVED', 'MEDICAL_EQUIPMENT_LOAN_REJECTED', 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_ISSUED', 'MEDICAL_EQUIPMENT_LOAN_ESCALATED', 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_REJECTED', 'MEDICAL_EQUIPMENT_LOAN_EMERGENCY_RESOLVED', 'MEDICAL_EQUIPMENT_LOAN_RETURN_REQUIRED', 'PLAN_REPORT_REVIEW_REQUESTED', 'HIRING_SURVEY_DRAFT_CREATED', 'SURVEY_RESPONSE_SUBMITTED', 'SURVEY_RESPONSE_APPROVED', 'SURVEY_RESPONSE_REJECTED', 'PROBATION_REVIEW_DUE_SOON', 'PROBATION_REVIEW_COMPLETED', 'ONBOARDING_TASKS_ASSIGNED', 'ONBOARDING_TASK_VERIFY_REQUESTED', 'ONBOARDING_TASK_VERIFIED', 'ONBOARDING_TASK_REJECTED', 'ONBOARDING_CONTENT_COMPLETED', 'MANDATORY_MINIMUM_VIOLATION_REQUIRES_REPLAN', 'ACQUISITION_SURVEY_PUBLISHED', 'ACQUISITION_SURVEY_CLOSED');
ALTER TABLE "public"."Notification" ALTER COLUMN "type" TYPE "public"."NotificationType_new" USING ("type"::text::"public"."NotificationType_new");
ALTER TYPE "public"."NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "public"."NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."TransferNegotiationLog" DROP CONSTRAINT "TransferNegotiationLog_transferRequestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TransferNegotiationLog" DROP CONSTRAINT "TransferNegotiationLog_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."FormationSnapshot" DROP CONSTRAINT "FormationSnapshot_matchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FormationSnapshot" DROP CONSTRAINT "FormationSnapshot_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProspectNegotiationLog" DROP CONSTRAINT "ProspectNegotiationLog_prospectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProspectNegotiationLog" DROP CONSTRAINT "ProspectNegotiationLog_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."OperatingExpense" DROP CONSTRAINT "OperatingExpense_paidById_fkey";

-- DropForeignKey (conditional: may not exist if already dropped in a prior migration)
ALTER TABLE "public"."MaintenanceRequest" DROP CONSTRAINT IF EXISTS "MaintenanceRequest_sourceScheduleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Certification" DROP CONSTRAINT "Certification_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Certification" DROP CONSTRAINT "Certification_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Certification" DROP CONSTRAINT "Certification_gmApprovedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Certification" DROP CONSTRAINT "Certification_playerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Certification" DROP CONSTRAINT "Certification_coachId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Certification" DROP CONSTRAINT "Certification_staffId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CertificationReminderLog" DROP CONSTRAINT "CertificationReminderLog_certificationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SponsorshipPayment" DROP CONSTRAINT "SponsorshipPayment_sponsorshipId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SponsorshipPayment" DROP CONSTRAINT "SponsorshipPayment_appliedClauseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SalesRecord" DROP CONSTRAINT "SalesRecord_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."PreventiveSchedule" DROP CONSTRAINT "PreventiveSchedule_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FacilityAccessLog" DROP CONSTRAINT "FacilityAccessLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EquipmentDisposalVerification" DROP CONSTRAINT "EquipmentDisposalVerification_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EquipmentDisposalVerification" DROP CONSTRAINT "EquipmentDisposalVerification_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."EquipmentDisposalVerification" DROP CONSTRAINT "EquipmentDisposalVerification_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."SponsorshipClause" DROP CONSTRAINT "SponsorshipClause_sponsorshipId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SponsorshipExposureEvent" DROP CONSTRAINT "SponsorshipExposureEvent_sponsorshipId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SponsorshipExposureEvent" DROP CONSTRAINT "SponsorshipExposureEvent_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."PartnerContactLog" DROP CONSTRAINT "PartnerContactLog_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PartnerContactLog" DROP CONSTRAINT "PartnerContactLog_actorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FinancialReportRevenueLog" DROP CONSTRAINT "FinancialReportRevenueLog_changedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerAcquisitionSurvey" DROP CONSTRAINT "PlayerAcquisitionSurvey_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerAcquisitionSurveyResponse" DROP CONSTRAINT "PlayerAcquisitionSurveyResponse_surveyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerAcquisitionSurveyResponse" DROP CONSTRAINT "PlayerAcquisitionSurveyResponse_respondentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerAcquisitionSurveyResponseItem" DROP CONSTRAINT "PlayerAcquisitionSurveyResponseItem_responseId_fkey";

-- AlterTable
ALTER TABLE "public"."Partner" DROP COLUMN "tier",
DROP COLUMN "tierReason";

-- AlterTable
ALTER TABLE "public"."PartnerContract" DROP COLUMN "penaltyPerDay",
DROP COLUMN "resolutionDays",
DROP COLUMN "responseHours";

-- AlterTable
ALTER TABLE "public"."TrainingLoad" ALTER COLUMN "version" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."BudgetPlanRequestLine" ALTER COLUMN "triggers" SET DEFAULT ARRAY[]::"public"."TriggerType"[];

-- AlterTable
ALTER TABLE "public"."FacilityInspection" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."MaintenanceRequest" DROP COLUMN "sourceScheduleId";

-- AlterTable
ALTER TABLE "public"."Sponsorship" DROP COLUMN "currency",
DROP COLUMN "targetExposureCount",
DROP COLUMN "targetFanReach",
DROP COLUMN "targetMediaValue",
ALTER COLUMN "mediaValue" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."SponsorshipPayment" DROP COLUMN "adjustedAmount",
DROP COLUMN "adjustmentReason",
DROP COLUMN "appliedClauseId";

-- AlterTable
ALTER TABLE "public"."SalesRecord" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."AttendanceAppeal" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."PlanReport" ALTER COLUMN "attachments" SET DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "public"."Certification";

-- DropTable
DROP TABLE "public"."CertificationReminderLog";

-- DropTable
DROP TABLE "public"."PreventiveSchedule";

-- DropTable
DROP TABLE "public"."FacilityAccessLog";

-- DropTable
DROP TABLE "public"."EquipmentDisposalVerification";

-- DropTable
DROP TABLE "public"."SponsorshipClause";

-- DropTable
DROP TABLE "public"."SponsorshipExposureEvent";

-- DropTable
DROP TABLE "public"."PartnerContactLog";

-- DropEnum
DROP TYPE "public"."DisposalVerificationStatus";

-- DropEnum
DROP TYPE "public"."CertificationType";

-- DropEnum
DROP TYPE "public"."CertEntityType";

-- DropEnum
DROP TYPE "public"."CertStatus";

-- DropEnum
DROP TYPE "public"."PartnerTier";

-- DropEnum
DROP TYPE "public"."ClauseType";

-- DropEnum
DROP TYPE "public"."ClauseStatus";

-- DropEnum
DROP TYPE "public"."ContactChannel";

-- DropEnum
DROP TYPE "public"."ExposureChannel";

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "public"."Department"("name" ASC);

-- AddForeignKey
ALTER TABLE "public"."FinancialReportRevenueLog" ADD CONSTRAINT "FinancialReportRevenueLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormationSnapshot" ADD CONSTRAINT "FormationSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."FormationSnapshot" ADD CONSTRAINT "FormationSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."OperatingExpense" ADD CONSTRAINT "OperatingExpense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PlayerAcquisitionSurvey" ADD CONSTRAINT "PlayerAcquisitionSurvey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PlayerAcquisitionSurveyResponse" ADD CONSTRAINT "PlayerAcquisitionSurveyResponse_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PlayerAcquisitionSurveyResponse" ADD CONSTRAINT "PlayerAcquisitionSurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."PlayerAcquisitionSurvey"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PlayerAcquisitionSurveyResponseItem" ADD CONSTRAINT "PlayerAcquisitionSurveyResponseItem_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."PlayerAcquisitionSurveyResponse"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ProspectNegotiationLog" ADD CONSTRAINT "ProspectNegotiationLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ProspectNegotiationLog" ADD CONSTRAINT "ProspectNegotiationLog_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "public"."Prospect"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SponsorshipPayment" ADD CONSTRAINT "SponsorshipPayment_sponsorshipId_fkey" FOREIGN KEY ("sponsorshipId") REFERENCES "public"."Sponsorship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferNegotiationLog" ADD CONSTRAINT "TransferNegotiationLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."TransferNegotiationLog" ADD CONSTRAINT "TransferNegotiationLog_transferRequestId_fkey" FOREIGN KEY ("transferRequestId") REFERENCES "public"."TransferRequest"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- RenameIndex
ALTER INDEX "public"."DepartmentReviewerConfig_subjectDepartmentId_reviewerDepart_key" RENAME TO "DepartmentReviewerConfig_subjectDepartmentId_reviewerDepartment";


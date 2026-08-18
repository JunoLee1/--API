import { randomInt } from "crypto";
import bcrypt from "bcrypt";
import { RecruitmentRepository } from "./recruitment.repo";
import { PlanReportRepository } from "../plan-report/plan-report.repo";
import { AppError } from "../lib/appError";
import { maskEmail, maskPhone } from "../lib/maskPii";
import { getPrisma } from "../lib/prisma";
import { NotificationRepository } from "../notification/notification.repo";
import { sendApplicationStatusEmail } from "../lib/email";
import type {
  CreateJobPostingDto,
  UpdateJobPostingDto,
  JobPostingListQuery,
  CreateJobApplicationDto,
  UpdateJobApplicationDto,
  CreateInterviewDto,
  UpdateInterviewDto,
  CreateReferenceCheckDto,
  UpdateReferenceCheckDto,
} from "./dto/recruitment.dto";
import type { InterviewRound } from "../generated/enums";

function maskApplication<T extends { email: string | null; phone: string | null; onboarding?: { user?: { email: string } | null } | null }>(app: T): T {
  return {
    ...app,
    email: app.email ? maskEmail(app.email) : app.email,
    phone: maskPhone(app.phone),
    onboarding: app.onboarding?.user
      ? { ...app.onboarding, user: { ...app.onboarding.user, email: maskEmail(app.onboarding.user.email) } }
      : app.onboarding,
  };
}

export class RecruitmentService {
  constructor(
    private repo: RecruitmentRepository,
    private notifRepo?: NotificationRepository,
    private planReportRepo?: PlanReportRepository,
  ) {}

  // --- JobPosting ---

  listPostings(query: JobPostingListQuery) {
    return this.repo.findAllPostings(query);
  }

  async getPosting(id: number) {
    const posting = await this.repo.findPostingById(id);
    if (!posting) throw new AppError(404, "JOB_POSTING_NOT_FOUND");
    return posting;
  }

  async createPosting(dto: CreateJobPostingDto, createdById: number) {
    if (!this.planReportRepo) throw new AppError(500, "INTERNAL_ERROR");
    const planReport = await this.planReportRepo.findByIdLight(dto.planReportId);
    if (!planReport) throw new AppError(404, "PLAN_REPORT_NOT_FOUND");
    if (planReport.status !== "APPROVED") throw new AppError(409, "PLAN_REPORT_NOT_APPROVED");
    if (planReport.templateType !== "HR") throw new AppError(409, "PLAN_REPORT_NOT_HR_TYPE");
    if (planReport.jobPosting) throw new AppError(409, "PLAN_REPORT_ALREADY_LINKED");
    return this.repo.createPosting({ ...dto, createdById });
  }

  async updatePosting(id: number, dto: UpdateJobPostingDto) {
    await this.getPosting(id);
    return this.repo.updatePosting(id, dto);
  }

  async approvePosting(id: number, approvedById: number) {
    const posting = await this.getPosting(id);
    if (posting.status !== "DRAFT") throw new AppError(409, "JOB_POSTING_NOT_DRAFT");
    return this.repo.approvePosting(id, approvedById);
  }

  async closePosting(id: number) {
    const posting = await this.getPosting(id);
    if (posting.status === "CLOSED") throw new AppError(409, "JOB_POSTING_ALREADY_CLOSED");
    return this.repo.closePosting(id);
  }

  // --- JobApplication ---

  async listApplications(postingId: number) {
    await this.getPosting(postingId);
    const apps = await this.repo.findApplicationsByPosting(postingId);
    return apps.map(maskApplication);
  }

  async getApplication(id: number) {
    const app = await this.repo.findApplicationById(id);
    if (!app) throw new AppError(404, "JOB_APPLICATION_NOT_FOUND");
    return maskApplication(app);
  }

  async apply(postingId: number, dto: CreateJobApplicationDto) {
    const posting = await this.getPosting(postingId);
    if (posting.status !== "OPEN") throw new AppError(409, "JOB_POSTING_NOT_OPEN");
    return this.repo.createApplication(postingId, dto);
  }

  async updateApplication(id: number, dto: UpdateJobApplicationDto) {
    await this.getApplication(id);
    if (dto.status !== undefined && dto.status !== "SCREENING") {
      throw new AppError(400, "INVALID_STATUS_TRANSITION");
    }
    return this.repo.updateApplication(id, dto);
  }

  async rejectApplication(id: number, actorId?: number) {
    const app = await this.getApplication(id);
    if (app.status === "REJECTED") throw new AppError(409, "APPLICATION_ALREADY_REJECTED");
    const result = await this.repo.rejectApplication(id, actorId as number);
    // SJ6: email applicant on rejection — fetch raw (unmasked) record for email address
    const rawApp = await this.repo.findApplicationById(id);
    if (rawApp?.email) {
      void sendApplicationStatusEmail(rawApp.email, rawApp.applicantName, "REJECTED").catch(console.error);
    }
    return result;
  }

  async reinstateApplication(id: number, actorId: number) {
    const app = await this.getApplication(id);
    if (app.status !== "REJECTED") throw new AppError(409, "APPLICATION_NOT_REJECTED");
    if (!(app as any).previousStatus) throw new AppError(409, "NO_PREVIOUS_STATUS");
    return this.repo.reinstateApplication(id, actorId);
  }

  async offerApplication(id: number, offeredById: number) {
    const app = await this.getApplication(id);
    if (app.status !== "REFERENCE_CHECK") throw new AppError(409, "APPLICATION_NOT_IN_REFERENCE_CHECK");
    const refCheck = await getPrisma().referenceCheck.findUnique({
      where: { applicationId: id },
      select: { result: true },
    });
    if (refCheck?.result === "FLAGGED") {
      throw new AppError(409, "REFERENCE_CHECK_FLAGGED");
    }
    const result = await this.repo.offerApplication(id, offeredById, offeredById);
    // SJ6: email applicant on offer — fetch raw (unmasked) record for email address
    const rawApp = await this.repo.findApplicationById(id);
    if (rawApp?.email) {
      void sendApplicationStatusEmail(rawApp.email, rawApp.applicantName, "OFFERED").catch(console.error);
    }
    return result;
  }

  // --- Interview ---

  async scheduleInterview(applicationId: number, dto: CreateInterviewDto, actorId?: number) {
    await this.getApplication(applicationId);
    const existing = await this.repo.findInterview(applicationId, dto.round);
    if (existing) throw new AppError(409, "INTERVIEW_ALREADY_EXISTS");
    const targetStatus: "INTERVIEW_1" | "INTERVIEW_2" =
      dto.round === "ROUND_1" ? "INTERVIEW_1" : "INTERVIEW_2";
    await this.repo.setApplicationStatus(applicationId, targetStatus);
    const interview = await this.repo.createInterview(applicationId, dto);

    // S3: notify assigned interviewers
    if (dto.interviewerIds && dto.interviewerIds.length > 0 && this.notifRepo) {
      void this.notifRepo.createForUsers(
        dto.interviewerIds,
        "INTERVIEW_SCHEDULED",
        () => ({
          title: "면접 일정 배정됨",
          body: `${dto.round} 면접이 배정되었습니다. 일정을 확인해주세요.`,
        }),
        interview.id,
      ).catch(console.error);
    }

    return interview;
  }

  async updateInterview(applicationId: number, round: InterviewRound, dto: UpdateInterviewDto) {
    const existing = await this.repo.findInterview(applicationId, round);
    if (!existing) throw new AppError(404, "INTERVIEW_NOT_FOUND");

    // SJ3: if confirming a final result, all three scores must be present
    if (dto.result && dto.result !== "PENDING") {
      const scoreSkill = dto.scoreSkill ?? existing.scoreSkill;
      const scoreComm = dto.scoreComm ?? existing.scoreComm;
      const scoreCulture = dto.scoreCulture ?? existing.scoreCulture;
      if (scoreSkill == null || scoreComm == null || scoreCulture == null) {
        throw new AppError(400, "INTERVIEW_SCORES_REQUIRED");
      }
    }

    return this.repo.updateInterview(applicationId, round, dto);
  }

  // --- ReferenceCheck ---

  async createReferenceCheck(applicationId: number, dto: CreateReferenceCheckDto, actorId?: number) {
    const app = await this.getApplication(applicationId);

    // CL5: consent must not be explicitly declined
    if ((app as any).referenceCheckConsent === false) {
      throw new AppError(409, "REFERENCE_CHECK_CONSENT_DECLINED");
    }

    await this.repo.setApplicationStatus(applicationId, "REFERENCE_CHECK");
    return this.repo.createReferenceCheck(applicationId, dto);
  }

  async updateReferenceCheck(applicationId: number, dto: UpdateReferenceCheckDto) {
    await this.getApplication(applicationId);
    return this.repo.updateReferenceCheck(applicationId, dto);
  }

  // --- Onboarding ---

  async startOnboarding(applicationId: number, userId: number) {
    const app = await this.getApplication(applicationId);
    if (app.status !== "OFFERED") throw new AppError(409, "APPLICATION_NOT_OFFERED");
    const existing = await this.repo.findOnboardingByApplication(applicationId);
    if (existing) throw new AppError(409, "ONBOARDING_ALREADY_STARTED");
    const rawOtp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const record = await this.repo.createOnboarding(applicationId, userId, otpHash, expiresAt);
    return { ...record, otpCode: rawOtp };
  }

  async verifyEmail(applicationId: number, otp: string) {
    const onboarding = await this.repo.findOnboardingByApplication(applicationId);
    if (!onboarding) throw new AppError(404, "ONBOARDING_NOT_FOUND");
    if (onboarding.emailVerifiedAt) throw new AppError(409, "EMAIL_ALREADY_VERIFIED");
    const isValid = await bcrypt.compare(otp, onboarding.otpCode);
    if (!isValid) throw new AppError(400, "INVALID_OTP");
    if (onboarding.otpExpiresAt < new Date()) throw new AppError(400, "OTP_EXPIRED");
    return this.repo.markEmailVerified(applicationId);
  }

  async completeMfa(applicationId: number) {
    const onboarding = await this.repo.findOnboardingByApplication(applicationId);
    if (!onboarding) throw new AppError(404, "ONBOARDING_NOT_FOUND");
    if (!onboarding.emailVerifiedAt) throw new AppError(409, "EMAIL_NOT_VERIFIED");
    if (onboarding.mfaRegisteredAt) throw new AppError(409, "MFA_ALREADY_REGISTERED");
    const result = await this.repo.markMfaRegistered(applicationId);

    // Mark application as ONBOARDED (system-initiated, no human actorId — use 0 as sentinel)
    const prisma = getPrisma();
    const application = await this.repo.findApplicationById(applicationId);
    if (application) {
      await this.repo.completeOnboarding(applicationId, 0);

      // Auto-create StaffRecord if not already exists
      const existingRecord = await prisma.staffRecord.findFirst({
        where: { employeeId: String(applicationId) },
      });
      if (!existingRecord) {
        await prisma.staffRecord.create({
          data: {
            name: application.applicantName,
            role: application.posting?.title ?? "Staff",
            employeeId: String(applicationId),
            isActive: true,
            createdById: application.offeredById ?? 1,
            employmentStartDate: new Date(),
          } as any,
        });
      }
    }

    return result;
  }

  getHeadcountProgress() {
    return this.repo.getHeadcountProgress();
  }

  getTimeToHireStats() {
    return this.repo.getTimeToHireStats();
  }

  getCostPerHire() {
    return this.repo.getCostPerHire();
  }

  addInterviewerScore(interviewId: number, data: { interviewerId: number; scoreSkill?: number; scoreComm?: number; scoreCulture?: number; comment?: string }, actorId: number) {
    return this.repo.addInterviewerScore({ interviewId, ...data }, actorId);
  }

  getInterviewerScores(interviewId: number) {
    return this.repo.getInterviewerScores(interviewId);
  }
}

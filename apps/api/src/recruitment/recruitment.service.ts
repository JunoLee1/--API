import { RecruitmentRepository } from "./recruitment.repo";
import { AppError } from "../lib/appError";
import { maskEmail, maskPhone } from "../lib/maskPii";
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
  constructor(private repo: RecruitmentRepository) {}

  // --- JobPosting ---

  listPostings(query: JobPostingListQuery) {
    return this.repo.findAllPostings(query);
  }

  async getPosting(id: number) {
    const posting = await this.repo.findPostingById(id);
    if (!posting) throw new AppError(404, "JOB_POSTING_NOT_FOUND");
    return posting;
  }

  createPosting(dto: CreateJobPostingDto, createdById: number) {
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

  async rejectApplication(id: number) {
    const app = await this.getApplication(id);
    if (app.status === "REJECTED") throw new AppError(409, "APPLICATION_ALREADY_REJECTED");
    return this.repo.rejectApplication(id);
  }

  async offerApplication(id: number, offeredById: number) {
    const app = await this.getApplication(id);
    if (app.status !== "REFERENCE_CHECK") throw new AppError(409, "APPLICATION_NOT_IN_REFERENCE_CHECK");
    return this.repo.offerApplication(id, offeredById);
  }

  // --- Interview ---

  async scheduleInterview(applicationId: number, dto: CreateInterviewDto) {
    await this.getApplication(applicationId);
    const existing = await this.repo.findInterview(applicationId, dto.round);
    if (existing) throw new AppError(409, "INTERVIEW_ALREADY_EXISTS");
    const targetStatus: "INTERVIEW_1" | "INTERVIEW_2" =
      dto.round === "ROUND_1" ? "INTERVIEW_1" : "INTERVIEW_2";
    await this.repo.setApplicationStatus(applicationId, targetStatus);
    return this.repo.createInterview(applicationId, dto);
  }

  async updateInterview(applicationId: number, round: InterviewRound, dto: UpdateInterviewDto) {
    const existing = await this.repo.findInterview(applicationId, round);
    if (!existing) throw new AppError(404, "INTERVIEW_NOT_FOUND");
    return this.repo.updateInterview(applicationId, round, dto);
  }

  // --- ReferenceCheck ---

  async createReferenceCheck(applicationId: number, dto: CreateReferenceCheckDto) {
    await this.getApplication(applicationId);
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
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    return this.repo.createOnboarding(applicationId, userId, otp, expiresAt);
  }

  async verifyEmail(applicationId: number, otp: string) {
    const onboarding = await this.repo.findOnboardingByApplication(applicationId);
    if (!onboarding) throw new AppError(404, "ONBOARDING_NOT_FOUND");
    if (onboarding.emailVerifiedAt) throw new AppError(409, "EMAIL_ALREADY_VERIFIED");
    if (onboarding.otpCode !== otp) throw new AppError(400, "INVALID_OTP");
    if (onboarding.otpExpiresAt < new Date()) throw new AppError(400, "OTP_EXPIRED");
    return this.repo.markEmailVerified(applicationId);
  }

  async completeMfa(applicationId: number) {
    const onboarding = await this.repo.findOnboardingByApplication(applicationId);
    if (!onboarding) throw new AppError(404, "ONBOARDING_NOT_FOUND");
    if (!onboarding.emailVerifiedAt) throw new AppError(409, "EMAIL_NOT_VERIFIED");
    if (onboarding.mfaRegisteredAt) throw new AppError(409, "MFA_ALREADY_REGISTERED");
    return this.repo.markMfaRegistered(applicationId);
  }

  getHeadcountProgress() {
    return this.repo.getHeadcountProgress();
  }

  getTimeToHireStats() {
    return this.repo.getTimeToHireStats();
  }

  addInterviewerScore(interviewId: number, data: { interviewerId: number; scoreSkill?: number; scoreComm?: number; scoreCulture?: number; comment?: string }) {
    return this.repo.addInterviewerScore({ interviewId, ...data });
  }

  getInterviewerScores(interviewId: number) {
    return this.repo.getInterviewerScores(interviewId);
  }
}

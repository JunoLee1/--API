import type { PrismaClient } from "../generated/client";
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
import type { InterviewRound, JobApplicationStatus } from "../generated/enums";
import { writeAuditLog } from "../lib/auditLog";

const POSTING_INCLUDE = {
  department: { select: { id: true, name: true } },
  createdBy: { select: { id: true, username: true } },
  approvedBy: { select: { id: true, username: true } },
  applications: { select: { id: true } },
} as const;

const APPLICATION_INCLUDE = {
  posting: { select: { id: true, title: true } },
  offeredBy: { select: { id: true, username: true } },
  interviews: { orderBy: { round: "asc" as const } },
  referenceCheck: true,
  onboarding: {
    include: { user: { select: { id: true, username: true, email: true } } },
  },
} as const;

export class RecruitmentRepository {
  constructor(private prisma: PrismaClient) {}

  // --- JobPosting ---

  findAllPostings(query: JobPostingListQuery) {
    return this.prisma.jobPosting.findMany({
      where: { ...(query.status && { status: query.status }) },
      include: POSTING_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findPostingById(id: number) {
    return this.prisma.jobPosting.findUnique({ where: { id }, include: POSTING_INCLUDE });
  }

  createPosting(data: CreateJobPostingDto & { createdById: number }) {
    return this.prisma.jobPosting.create({ data, include: POSTING_INCLUDE });
  }

  updatePosting(id: number, data: UpdateJobPostingDto) {
    return this.prisma.jobPosting.update({ where: { id }, data, include: POSTING_INCLUDE });
  }

  approvePosting(id: number, approvedById: number) {
    return this.prisma.jobPosting.update({
      where: { id },
      data: { status: "OPEN", approvedById, approvedAt: new Date() },
      include: POSTING_INCLUDE,
    });
  }

  closePosting(id: number) {
    return this.prisma.jobPosting.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date() },
      include: POSTING_INCLUDE,
    });
  }

  // --- JobApplication ---

  findApplicationsByPosting(postingId: number) {
    return this.prisma.jobApplication.findMany({
      where: { postingId },
      include: APPLICATION_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findApplicationById(id: number) {
    return this.prisma.jobApplication.findUnique({ where: { id }, include: APPLICATION_INCLUDE });
  }

  createApplication(postingId: number, data: CreateJobApplicationDto) {
    return this.prisma.jobApplication.create({
      data: { ...data, postingId },
      include: APPLICATION_INCLUDE,
    });
  }

  updateApplication(id: number, data: UpdateJobApplicationDto) {
    return this.prisma.jobApplication.update({
      where: { id },
      data,
      include: APPLICATION_INCLUDE,
    });
  }

  async rejectApplication(id: number, actorId: number) {
    const result = await this.prisma.jobApplication.update({
      where: { id },
      data: { status: "REJECTED", rejectedAt: new Date() },
      include: APPLICATION_INCLUDE,
    });
    void writeAuditLog({
      actorId,
      action: "JOB_APPLICATION_STATUS_CHANGED",
      targetId: id,
      detail: { newStatus: "REJECTED" },
    }).catch(console.error);
    return result;
  }

  async offerApplication(id: number, offeredById: number, actorId: number) {
    const result = await this.prisma.jobApplication.update({
      where: { id },
      data: { status: "OFFERED", offeredAt: new Date(), offeredById },
      include: APPLICATION_INCLUDE,
    });
    void writeAuditLog({
      actorId,
      action: "JOB_APPLICATION_STATUS_CHANGED",
      targetId: id,
      detail: { newStatus: "OFFERED" },
    }).catch(console.error);
    return result;
  }

  async completeOnboarding(id: number, actorId: number) {
    const result = await this.prisma.jobApplication.update({
      where: { id },
      data: { status: "ONBOARDED" },
      include: APPLICATION_INCLUDE,
    });
    void writeAuditLog({
      actorId,
      action: "JOB_APPLICATION_STATUS_CHANGED",
      targetId: id,
      detail: { newStatus: "ONBOARDED" },
    }).catch(console.error);
    return result;
  }

  async setApplicationStatus(id: number, status: JobApplicationStatus, actorId?: number) {
    const result = await this.prisma.jobApplication.update({
      where: { id },
      data: { status },
      include: APPLICATION_INCLUDE,
    });
    if (actorId != null) {
      void writeAuditLog({
        actorId,
        action: "JOB_APPLICATION_STATUS_CHANGED",
        targetId: id,
        detail: { newStatus: status },
      }).catch(console.error);
    }
    return result;
  }

  // --- Interview ---

  findInterview(applicationId: number, round: InterviewRound) {
    return this.prisma.interview.findUnique({
      where: { applicationId_round: { applicationId, round } },
    });
  }

  createInterview(applicationId: number, data: CreateInterviewDto) {
    return this.prisma.interview.create({
      data: {
        applicationId,
        round: data.round,
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.interviewerIds && { interviewerIds: data.interviewerIds }),
      },
    });
  }

  updateInterview(applicationId: number, round: InterviewRound, data: UpdateInterviewDto) {
    return this.prisma.interview.update({
      where: { applicationId_round: { applicationId, round } },
      data: {
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.interviewerIds && { interviewerIds: data.interviewerIds }),
        ...(data.scoreSkill != null && { scoreSkill: data.scoreSkill }),
        ...(data.scoreComm != null && { scoreComm: data.scoreComm }),
        ...(data.scoreCulture != null && { scoreCulture: data.scoreCulture }),
        ...(data.comment != null && { comment: data.comment }),
        ...(data.result && { result: data.result }),
      },
    });
  }

  // --- ReferenceCheck ---

  createReferenceCheck(applicationId: number, data: CreateReferenceCheckDto) {
    return this.prisma.referenceCheck.create({ data: { ...data, applicationId } });
  }

  updateReferenceCheck(applicationId: number, data: UpdateReferenceCheckDto) {
    return this.prisma.referenceCheck.update({
      where: { applicationId },
      data,
    });
  }

  // --- Onboarding ---

  createOnboarding(applicationId: number, userId: number, otpCode: string, otpExpiresAt: Date) {
    return this.prisma.onboarding.create({
      data: { applicationId, userId, otpCode, otpExpiresAt },
    });
  }

  findOnboardingByApplication(applicationId: number) {
    return this.prisma.onboarding.findUnique({
      where: { applicationId },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  markEmailVerified(applicationId: number) {
    return this.prisma.onboarding.update({
      where: { applicationId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  markMfaRegistered(applicationId: number) {
    return this.prisma.onboarding.update({
      where: { applicationId },
      data: { mfaRegisteredAt: new Date(), completedAt: new Date() },
    });
  }

  async getHeadcountProgress() {
    const postings = await this.prisma.jobPosting.findMany({
      where: { status: { in: ["OPEN", "CLOSED"] } },
      select: {
        id: true,
        title: true,
        headcount: true,
        status: true,
        _count: { select: { applications: { where: { status: "ONBOARDED" } } } },
      },
    });
    return postings.map((p) => ({
      postingId: p.id,
      title: p.title,
      targetHeadcount: p.headcount,
      hiredCount: p._count.applications,
      fillRate: p.headcount === 0 ? 0 : Math.round((p._count.applications / p.headcount) * 100),
      status: p.status,
    }));
  }

  async getTimeToHireStats() {
    const hired = await this.prisma.jobApplication.findMany({
      where: { status: "ONBOARDED", offeredAt: { not: null } },
      select: { createdAt: true, offeredAt: true, posting: { select: { title: true } } },
    });
    const stats = hired.map((a) => ({
      title: a.posting.title,
      daysToHire: Math.round((a.offeredAt!.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    }));
    const avg = stats.length === 0 ? 0 : Math.round(stats.reduce((s, v) => s + v.daysToHire, 0) / stats.length);
    return { averageDaysToHire: avg, records: stats };
  }

  // --- InterviewerScore ---

  async addInterviewerScore(data: { interviewId: number; interviewerId: number; scoreSkill?: number; scoreComm?: number; scoreCulture?: number; comment?: string }, actorId: number) {
    const result = await this.prisma.interviewerScore.create({ data });
    void writeAuditLog({
      actorId,
      action: "INTERVIEW_SCORE_RECORDED",
      targetId: data.interviewId,
      detail: {
        interviewerId: data.interviewerId,
        scoreSkill: data.scoreSkill,
        scoreComm: data.scoreComm,
        scoreCulture: data.scoreCulture,
      },
    }).catch(console.error);
    return result;
  }

  getInterviewerScores(interviewId: number) {
    return this.prisma.interviewerScore.findMany({
      where: { interviewId },
      include: { interviewer: { select: { id: true, nickname: true } } },
    });
  }
}

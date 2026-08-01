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
import type { InterviewRound } from "../generated/enums";

const POSTING_INCLUDE = {
  department: { select: { id: true, name: true } },
  createdBy: { select: { id: true, username: true } },
  approvedBy: { select: { id: true, username: true } },
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

  rejectApplication(id: number) {
    return this.prisma.jobApplication.update({
      where: { id },
      data: { status: "REJECTED", rejectedAt: new Date() },
      include: APPLICATION_INCLUDE,
    });
  }

  offerApplication(id: number, offeredById: number) {
    return this.prisma.jobApplication.update({
      where: { id },
      data: { status: "OFFERED", offeredAt: new Date(), offeredById },
      include: APPLICATION_INCLUDE,
    });
  }

  completeOnboarding(id: number) {
    return this.prisma.jobApplication.update({
      where: { id },
      data: { status: "ONBOARDED" },
      include: APPLICATION_INCLUDE,
    });
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
}

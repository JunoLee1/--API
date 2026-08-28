import { randomInt } from "crypto";
import bcrypt from "bcrypt";
import { RecruitmentRepository } from "./recruitment.repo";
import { PlanReportRepository } from "../plan-report/plan-report.repo";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
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
  ScreenApplicationDto,
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

/**
 * Trim + drop empty strings so the DB never stores accidental whitespace-only
 * entries that would silently break the HiringDispatch gate's set-lookup.
 * `undefined` in => `undefined` out — lets the caller distinguish "no update"
 * from "clear to empty".
 */
function normalizeRequiredDocuments(input: string[] | undefined): string[] | undefined {
  if (input === undefined) return undefined;
  return input.map((s) => s.trim()).filter((s) => s.length > 0);
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

    if (!dto.hiringPlanItemId) throw new AppError(400, "HIRING_PLAN_ITEM_REQUIRED");
    const hiringPlanItem = await this.planReportRepo.findHiringPlanItemById(dto.hiringPlanItemId);
    if (!hiringPlanItem) throw new AppError(404, "HIRING_PLAN_ITEM_NOT_FOUND");
    if (hiringPlanItem.planReportId !== dto.planReportId) throw new AppError(400, "HIRING_PLAN_ITEM_MISMATCH");
    if (hiringPlanItem.status === "FULFILLED") throw new AppError(409, "HIRING_PLAN_ITEM_ALREADY_FULFILLED");
    if (hiringPlanItem.status === "CANCELLED") throw new AppError(409, "HIRING_PLAN_ITEM_CANCELLED");

    const requiredDocuments = normalizeRequiredDocuments(dto.requiredDocuments);
    const posting = await this.repo.createPosting({
      ...dto,
      ...(requiredDocuments !== undefined && { requiredDocuments }),
      createdById,
    });

    // 첫 JobPosting 생성 시 PLANNED → IN_PROGRESS 전이 (idempotent)
    if (hiringPlanItem.status === "PLANNED") {
      await this.planReportRepo.updateHiringPlanItemStatus(dto.hiringPlanItemId, "IN_PROGRESS");
    }

    return posting;
  }

  async bulkCreatePostingsFromPlanReport(planReportId: number, createdById: number) {
    if (!this.planReportRepo) throw new AppError(500, "INTERNAL_ERROR");

    const planReport = await this.planReportRepo.findByIdLight(planReportId);
    if (!planReport) throw new AppError(404, "PLAN_REPORT_NOT_FOUND");
    if (planReport.status !== "APPROVED") throw new AppError(409, "PLAN_REPORT_NOT_APPROVED");
    if (planReport.templateType !== "HR") throw new AppError(409, "PLAN_REPORT_NOT_HR_TYPE");

    const allItems = await this.planReportRepo.listHiringPlanItems(planReportId);

    const created: any[] = [];
    const skipped: { id: number; roleTitle: string; status: string }[] = [];

    for (const item of allItems) {
      if (item.status !== "PLANNED") {
        skipped.push({ id: item.id, roleTitle: item.roleTitle, status: item.status });
        continue;
      }

      // Auto-generate title + description
      const title = `${planReport.title} - ${item.roleTitle}`;
      const description = [
        `역할: ${item.roleTitle}`,
        `채용 인원: ${item.headcount}명`,
        `우선순위: ${item.priority}`,
        item.quarter ? `분기: Q${item.quarter}` : null,
        item.estimatedBudget ? `예산: ${item.estimatedBudget.toLocaleString()}원` : null,
      ].filter(Boolean).join(" · ");

      const dto: CreateJobPostingDto = {
        planReportId,
        hiringPlanItemId: item.id,
        title,
        description,
        headcount: item.headcount,
      };
      if (planReport.departmentId != null) dto.departmentId = planReport.departmentId;
      const posting = await this.createPosting(dto, createdById);
      created.push(posting);
    }

    return { created, skipped };
  }

  async updatePosting(id: number, dto: UpdateJobPostingDto) {
    await this.getPosting(id);
    const requiredDocuments = normalizeRequiredDocuments(dto.requiredDocuments);
    return this.repo.updatePosting(id, {
      ...dto,
      ...(requiredDocuments !== undefined && { requiredDocuments }),
    });
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
    const existing = await this.repo.findApplicationByEmail(postingId, dto.email);
    if (existing) throw new AppError(409, "APPLICATION_DUPLICATE");
    return this.repo.createApplication(postingId, dto);
  }

  async updateApplication(id: number, dto: UpdateJobApplicationDto) {
    await this.getApplication(id);
    if (dto.status !== undefined && dto.status !== "SCREENING") {
      throw new AppError(400, "INVALID_STATUS_TRANSITION");
    }
    return this.repo.updateApplication(id, dto);
  }

  async screenApplication(id: number, dto: ScreenApplicationDto, actorId: number) {
    const app = await this.getApplication(id);
    if (app.status !== "SCREENING") throw new AppError(409, "INVALID_STATUS_FOR_SCREEN");
    if (dto.result === "FAIL" && !dto.notes?.trim()) {
      throw new AppError(400, "SCREENING_NOTES_REQUIRED_FOR_FAIL");
    }

    return this.repo.screenApplication(id, {
      screeningResult: dto.result,
      screeningNotes: dto.notes ?? null,
      screenedById: actorId,
      screenedAt: new Date(),
    });
  }

  async rejectApplication(id: number, actorId?: number) {
    const app = await this.getApplication(id);
    if (app.status === "REJECTED") throw new AppError(409, "APPLICATION_ALREADY_REJECTED");
    const wasOffered = app.status === "OFFERED";
    const postingId = (app as any).posting?.id ?? (app as any).postingId ?? null;

    const result = await this.repo.rejectApplication(id, actorId as number);
    // SJ6: email applicant on rejection — fetch raw (unmasked) record for email address
    const rawApp = await this.repo.findApplicationById(id);
    if (rawApp?.email) {
      void sendApplicationStatusEmail(rawApp.email, rawApp.applicantName, "REJECTED").catch(console.error);
    }

    // Auto-promote from waitlist: only when OFFERED → REJECTED (headcount opens up).
    if (wasOffered && postingId && (this.repo as any).findTopWaitlistForPosting) {
      try {
        const top = await (this.repo as any).findTopWaitlistForPosting(postingId);
        if (top) {
          // I3 fix: atomically consume the waitlist Interview (WAITLIST → PASS).
          // If updateMany returns count=0, someone else already consumed it — silent skip
          // in the auto-promote path (not user-driven, so no error surface).
          // C1 fix: marks Interview as consumed so it no longer appears in waitlist queries.
          const consumed = await getPrisma().interview.updateMany({
            where: { id: top.id, result: "WAITLIST" },
            data: { result: "PASS" },
          });
          if (consumed.count === 0) {
            // Already consumed by a concurrent request — skip silently.
          } else {
            await this.repo.offerApplication(top.applicationId, actorId as number, actorId as number);
            const promotedApp = await this.repo.findApplicationById(top.applicationId);
            if (promotedApp?.email) {
              void sendApplicationStatusEmail(promotedApp.email, promotedApp.applicantName, "OFFERED").catch(console.error);
            }
            void writeAuditLog({
              actorId: actorId ?? 0,
              action: "APPLICATION_AUTO_PROMOTED_FROM_WAITLIST",
              targetId: top.applicationId,
              detail: { triggeredByRejectionOf: id },
            }).catch(console.error);
          }
        }
      } catch (err) {
        console.warn(`[auto-promote-waitlist] failed for posting=${postingId}:`, err);
      }
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

      // Fix #366: threshold policy applies only when confirming PASS.
      if (dto.result === "PASS") {
        const settings = (this.repo as any).getClubSettings
          ? await (this.repo as any).getClubSettings()
          : null;
        const threshold = settings?.interviewPassThreshold ?? 3;
        const belowThreshold =
          scoreSkill < threshold || scoreComm < threshold || scoreCulture < threshold;

        if (belowThreshold) {
          if (!dto.overrideThreshold) {
            throw new AppError(400, "INTERVIEW_SCORE_BELOW_THRESHOLD");
          }
          if (!dto.overrideReason?.trim()) {
            throw new AppError(400, "OVERRIDE_REASON_REQUIRED");
          }
          // Override 승인: audit log 남김. actorId 는 controller 에서 전달받는 확장 여지.
          void writeAuditLog({
            actorId: 0,
            action: "INTERVIEW_THRESHOLD_OVERRIDE",
            targetId: existing.id,
            detail: {
              reason: dto.overrideReason,
              scores: { scoreSkill, scoreComm, scoreCulture },
              threshold,
            },
          }).catch(console.error);
        }
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
    if (onboarding.otpExpiresAt < new Date()) throw new AppError(400, "OTP_EXPIRED");
    const isValid = await bcrypt.compare(otp, onboarding.otpCode);
    if (!isValid) throw new AppError(400, "INVALID_OTP");
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

      // HiringPlanItem fulfilledCount 증가 + FULFILLED 전이 (posting 이 hiringPlanItemId 를 가진 경우만).
      // $transaction 으로 원자성 보장 — increment 와 FULFILLED 전이가 함께 성공하거나 함께 실패.
      // updateMany where: { status: "IN_PROGRESS" } 로 CANCELLED race 방어 (CANCELLED 를 FULFILLED 로 덮어쓰지 않음).
      const hiringPlanItemId = application.posting?.hiringPlanItemId;
      if (hiringPlanItemId && this.planReportRepo) {
        await prisma.$transaction(async (tx) => {
          // IN_PROGRESS 인 경우만 진행 — PLANNED/FULFILLED/CANCELLED 는 skip
          const item = await tx.hiringPlanItem.findUnique({
            where: { id: hiringPlanItemId },
            select: { id: true, headcount: true, fulfilledCount: true, status: true },
          });
          if (!item || item.status !== "IN_PROGRESS") return;

          const updated = await tx.hiringPlanItem.update({
            where: { id: hiringPlanItemId },
            data: { fulfilledCount: { increment: 1 } },
            select: { fulfilledCount: true, headcount: true },
          });

          if (updated.fulfilledCount >= updated.headcount) {
            // guard: 다른 트랜잭션이 CANCELLED 로 바꿨으면 여기서 no-op
            await tx.hiringPlanItem.updateMany({
              where: { id: hiringPlanItemId, status: "IN_PROGRESS" },
              data: { status: "FULFILLED", fulfilledAt: new Date() },
            });
          }
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

  async getInterviewerScoreAggregate(applicationId: number, round: InterviewRound) {
    const interview = await this.repo.findInterview(applicationId, round);
    if (!interview) throw new AppError(404, "INTERVIEW_NOT_FOUND");

    const agg = await this.repo.aggregateInterviewerScores(interview.id);
    if (!agg || agg._count === 0) {
      throw new AppError(400, "NO_INTERVIEWER_SCORES_YET");
    }

    const round1 = (v: number | null | undefined) => (v == null ? null : Math.round(v));
    return {
      scoreSkill: round1(agg._avg.scoreSkill),
      scoreComm: round1(agg._avg.scoreComm),
      scoreCulture: round1(agg._avg.scoreCulture),
      method: "AVG" as const,
      count: agg._count,
    };
  }

  async finalizeInterviewScore(applicationId: number, round: InterviewRound) {
    const aggregate = await this.getInterviewerScoreAggregate(applicationId, round);
    // Null values pass through but are filtered out by repo.updateInterview (`!= null` guard),
    // so partial-null aggregates only update the categories that have scores.
    return this.repo.updateInterview(applicationId, round, {
      scoreSkill: aggregate.scoreSkill as number,
      scoreComm: aggregate.scoreComm as number,
      scoreCulture: aggregate.scoreCulture as number,
    });
  }

  // --- Waitlist (fix #366) ---

  async getWaitlistForPosting(postingId: number) {
    // I5 fix: 404 if posting doesn't exist (matches listApplications pattern).
    await this.getPosting(postingId);
    const waitlisted = await (this.repo as any).findWaitlistedInterviews(postingId);
    return waitlisted
      .map((iv: any) => ({
        interviewId: iv.id,
        applicationId: iv.applicationId,
        scoreSum: (iv.scoreSkill ?? 0) + (iv.scoreComm ?? 0) + (iv.scoreCulture ?? 0),
        application: iv.application,
      }))
      .sort((a: any, b: any) => b.scoreSum - a.scoreSum);
  }

  async promoteFromWaitlist(applicationId: number, actorId: number) {
    const app = await this.getApplication(applicationId);

    // C2 fix: status guard — reject terminal/already-offered states.
    const nonPromotableStatuses = ["OFFERED", "ONBOARDED", "REJECTED"];
    if (nonPromotableStatuses.includes(app.status)) {
      throw new AppError(409, "APPLICATION_NOT_PROMOTABLE");
    }

    const waitlistedInterview = await (this.repo as any).findWaitlistedInterviewByApplication(applicationId);
    if (!waitlistedInterview) throw new AppError(400, "NOT_WAITLISTED");

    // I3 fix: atomically consume the waitlist Interview (WAITLIST → PASS) before offering.
    // If updateMany returns count=0, a concurrent request already consumed it → 409.
    // C1 fix: marks Interview as consumed so it no longer appears in waitlist queries.
    const consumed = await getPrisma().interview.updateMany({
      where: { id: waitlistedInterview.id, result: "WAITLIST" },
      data: { result: "PASS" },
    });
    if (consumed.count === 0) {
      throw new AppError(409, "WAITLIST_ALREADY_CONSUMED");
    }

    // Reuse offerApplication for actual state change + audit trail.
    const result = await this.repo.offerApplication(applicationId, actorId, actorId);
    // Fetch raw (unmasked) record to send notification email.
    const rawApp = await this.repo.findApplicationById(applicationId);
    if (rawApp?.email) {
      void sendApplicationStatusEmail(rawApp.email, rawApp.applicantName, "OFFERED").catch(console.error);
    }
    void writeAuditLog({
      actorId,
      action: "APPLICATION_PROMOTED_FROM_WAITLIST",
      targetId: applicationId,
    }).catch(console.error);
    return result;
  }

  /**
   * closeSeason hook. Best-effort: 남은 모든 WAITLIST Interview 를 FAIL 처리 + 지원자 이메일 통보.
   */
  async expireAllWaitlists() {
    const findAll = (this.repo as any).findAllWaitlistedInterviews;
    const updateResult = (this.repo as any).updateInterviewResult;
    if (typeof findAll !== "function" || typeof updateResult !== "function") return;

    const allWaitlisted = await findAll.call(this.repo);
    for (const iv of allWaitlisted) {
      await updateResult.call(this.repo, iv.id, "FAIL");
      const app = await this.repo.findApplicationById(iv.applicationId);
      if (app?.email) {
        void sendApplicationStatusEmail(app.email, app.applicantName, "WAITLIST_EXPIRED").catch(console.error);
      }
    }
  }
}

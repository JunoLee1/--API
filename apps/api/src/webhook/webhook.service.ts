import type { PrismaClient } from "../generated/client";
import { AppError } from "../lib/appError";
import type { NormalizedApplication } from "./adapters/types";
import type { ApplicationSource } from "../generated/enums";

export class WebhookService {
  constructor(private prisma: PrismaClient) {}

  async handleInbound(data: NormalizedApplication, source: ApplicationSource) {
    const posting = await this.prisma.jobPosting.findFirst({
      where: { externalJobId: data.externalJobId },
      select: { id: true },
    });
    if (!posting) throw new AppError(404, "JOB_POSTING_NOT_FOUND");

    return this.prisma.jobApplication.upsert({
      where: {
        postingId_externalApplicantId: {
          postingId: posting.id,
          externalApplicantId: data.externalApplicantId,
        },
      },
      create: {
        postingId: posting.id,
        externalApplicantId: data.externalApplicantId,
        applicantName: data.applicantName,
        email: data.email,
        phone: data.phone ?? null,
        resumeUrl: data.resumeUrl ?? null,
        source,
        status: "APPLIED",
      },
      update: {},
    });
  }
}

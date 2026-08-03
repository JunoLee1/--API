import { PrismaClient } from "../generated/client";

const authorSelect = {
  id: true,
  nickname: true,
  role: true,
  coachingRole: true,
  frontOfficeRole: true,
} as const;

const reportInclude = {
  author: { select: authorSelect },
  reviewer: { select: authorSelect },
  firstReviewer: { select: authorSelect },
  secondReviewer: { select: authorSelect },
} as const;

export class ReportRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(
    userId: number,
    isGM: boolean,
    isHeadCoach: boolean = false,
    filters: { type?: string; status?: string } = {},
    isHrManager: boolean = false,
    isFinanceManager: boolean = false,
    isAssetManager: boolean = false,
    isHrStaff: boolean = false,
    isAssetStaff: boolean = false,
    isFinanceStaff: boolean = false,
  ) {
    const roleWhere = isGM
      ? {}
      : isHeadCoach
      ? { OR: [{ authorId: userId }, { type: "TRAINING" as const }] }
      : isHrManager
      ? { OR: [{ authorId: userId }, { type: "HR" as const }] }
      : isFinanceManager
      ? { OR: [{ authorId: userId }, { type: "FINANCIAL" as const }] }
      : isAssetManager
      ? { OR: [{ authorId: userId }, { type: "ASSET" as const }] }
      : isHrStaff
      ? { OR: [{ authorId: userId }, { type: "HR" as const }] }
      : isAssetStaff
      ? { OR: [{ authorId: userId }, { type: "ASSET" as const }] }
      : isFinanceStaff
      ? { OR: [{ authorId: userId }, { type: "FINANCIAL" as const }] }
      : { authorId: userId };

    const filterWhere = {
      ...(filters.type && { type: filters.type as any }),
      ...(filters.status && { status: filters.status as any }),
    };

    return this.prisma.report.findMany({
      where: { ...roleWhere, ...filterWhere },
      include: reportInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.report.findUnique({
      where: { id },
      include: reportInclude,
    });
  }

  create(data: { authorId: number; type: string; title: string; content: string; fileUrl?: string; fileName?: string }) {
    return this.prisma.report.create({
      data: data as any,
      include: reportInclude,
    });
  }

  update(id: number, data: { title?: string; content?: string; fileUrl?: string; fileName?: string }) {
    return this.prisma.report.update({
      where: { id },
      data,
      include: reportInclude,
    });
  }

  submit(id: number) {
    return this.prisma.report.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date(), rejectionReason: null },
      include: reportInclude,
    });
  }

  approve(id: number, reviewerId: number, nextStatus: "FIRST_APPROVED" | "SECOND_APPROVED" | "APPROVED") {
    const now = new Date();
    const data =
      nextStatus === "FIRST_APPROVED"
        ? { status: nextStatus, firstReviewerId: reviewerId, firstReviewedAt: now }
        : nextStatus === "SECOND_APPROVED"
        ? { status: nextStatus, secondReviewerId: reviewerId, secondReviewedAt: now }
        : { status: nextStatus, reviewerId, reviewedAt: now };

    return this.prisma.report.update({
      where: { id },
      data,
      include: reportInclude,
    });
  }

  reject(id: number, reviewerId: number, rejectionReason: string) {
    return this.prisma.report.update({
      where: { id },
      data: { status: "REJECTED", reviewerId, rejectionReason, reviewedAt: new Date() },
      include: reportInclude,
    });
  }
}

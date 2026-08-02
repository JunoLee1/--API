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
} as const;

export class ReportRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(
    userId: number,
    isGM: boolean,
    isHeadCoach: boolean = false,
    filters: { type?: string; status?: string } = {},
  ) {
    const roleWhere = isGM
      ? {}
      : isHeadCoach
      ? { OR: [{ authorId: userId }, { type: "TRAINING" as const }] }
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

  approve(id: number, reviewerId: number) {
    return this.prisma.report.update({
      where: { id },
      data: { status: "APPROVED", reviewerId, reviewedAt: new Date() },
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

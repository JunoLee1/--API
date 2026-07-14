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

  findAll(userId: number, isGM: boolean) {
    return this.prisma.report.findMany({
      where: isGM ? {} : { authorId: userId },
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
      data: { status: "SUBMITTED", submittedAt: new Date() },
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

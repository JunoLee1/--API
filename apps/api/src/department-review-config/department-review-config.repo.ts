import { PrismaClient } from "../generated/client";

export class DepartmentReviewerConfigRepository {
  constructor(private prisma: PrismaClient) {}

  findBySubject(subjectDepartmentId: number) {
    return this.prisma.departmentReviewerConfig.findMany({
      where: { subjectDepartmentId },
      include: {
        reviewerDepartment: { select: { id: true, name: true } },
      },
    });
  }

  create(subjectDepartmentId: number, reviewerDepartmentId: number) {
    return this.prisma.departmentReviewerConfig.create({
      data: { subjectDepartmentId, reviewerDepartmentId },
      include: { reviewerDepartment: { select: { id: true, name: true } } },
    });
  }

  delete(id: number) {
    return this.prisma.departmentReviewerConfig.delete({ where: { id } });
  }

  findReviewerDeptIds(subjectDepartmentId: number): Promise<number[]> {
    return this.prisma.departmentReviewerConfig
      .findMany({
        where: { subjectDepartmentId },
        select: { reviewerDepartmentId: true },
      })
      .then((rows) => rows.map((r) => r.reviewerDepartmentId));
  }
}

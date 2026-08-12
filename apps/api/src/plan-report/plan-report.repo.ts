import type { PrismaClient } from '../generated/client'
import { Prisma } from '../generated/client'
import type {
  CreatePlanReportDto,
  UpdatePlanReportDto,
  ListPlanReportQuery,
} from './dto/plan-report.dto'

export interface ReviewerDeptMap {
  hr?: number
  procurement?: number
  legal?: number
  facility?: number
  privacy?: number
}

const PLAN_INCLUDE = {
  department: { select: { id: true, name: true, headId: true } },
  createdBy: { select: { id: true, username: true } },
  approvedBy: { select: { id: true, username: true } },
  reviews: {
    include: {
      reviewerDept: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, username: true } },
    },
  },
} satisfies Prisma.PlanReportInclude

export class PlanReportRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(filters: ListPlanReportQuery) {
    return this.prisma.planReport.findMany({
      where: {
        ...(filters.templateType && { templateType: filters.templateType as any }),
        ...(filters.departmentId && { departmentId: Number(filters.departmentId) }),
        ...(filters.status && { status: filters.status as any }),
      },
      include: PLAN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: number) {
    return this.prisma.planReport.findUnique({ where: { id }, include: PLAN_INCLUDE })
  }

  create(dto: CreatePlanReportDto, createdById: number) {
    return this.prisma.planReport.create({
      data: {
        title: dto.title,
        purpose: dto.purpose,
        departmentId: dto.departmentId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        budget: dto.budget,
        expectedEffect: dto.expectedEffect,
        risks: dto.risks,
        attachments: dto.attachments ?? [],
        resultDueDate: new Date(dto.resultDueDate),
        templateType: dto.templateType,
        extraFields: dto.extraFields ? (dto.extraFields as Prisma.InputJsonValue) : Prisma.JsonNull,
        hasNewStaff: dto.hasNewStaff ?? false,
        hasContract: dto.hasContract ?? false,
        hasExternalLease: dto.hasExternalLease ?? false,
        hasPersonalInfo: dto.hasPersonalInfo ?? false,
        isNewBusiness: dto.isNewBusiness ?? false,
        createdById,
      },
      include: PLAN_INCLUDE,
    })
  }

  update(id: number, dto: UpdatePlanReportDto) {
    return this.prisma.planReport.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.purpose !== undefined && { purpose: dto.purpose }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.expectedEffect !== undefined && { expectedEffect: dto.expectedEffect }),
        ...(dto.risks !== undefined && { risks: dto.risks }),
        ...(dto.attachments !== undefined && { attachments: dto.attachments }),
        ...(dto.resultDueDate !== undefined && { resultDueDate: new Date(dto.resultDueDate) }),
        ...(dto.templateType !== undefined && { templateType: dto.templateType }),
        ...('extraFields' in dto && { extraFields: dto.extraFields as Prisma.InputJsonValue ?? Prisma.JsonNull }),
        ...(dto.hasNewStaff !== undefined && { hasNewStaff: dto.hasNewStaff }),
        ...(dto.hasContract !== undefined && { hasContract: dto.hasContract }),
        ...(dto.hasExternalLease !== undefined && { hasExternalLease: dto.hasExternalLease }),
        ...(dto.hasPersonalInfo !== undefined && { hasPersonalInfo: dto.hasPersonalInfo }),
        ...(dto.isNewBusiness !== undefined && { isNewBusiness: dto.isNewBusiness }),
      },
      include: PLAN_INCLUDE,
    })
  }

  async submit(id: number, reviewerDeptIds: number[], requiredApproverLevel: string | null) {
    return this.prisma.$transaction(async (tx) => {
      if (reviewerDeptIds.length > 0) {
        await tx.planReview.createMany({
          data: reviewerDeptIds.map((reviewerDeptId) => ({ planId: id, reviewerDeptId })),
          skipDuplicates: true,
        })
      }
      return tx.planReport.update({
        where: { id },
        data: {
          status: 'REVIEWING',
          submittedAt: new Date(),
          requiredApproverLevel: requiredApproverLevel as any ?? null,
        },
        include: PLAN_INCLUDE,
      })
    })
  }

  async allReviewsComplete(planId: number): Promise<boolean> {
    const total = await this.prisma.planReview.count({ where: { planId } })
    if (total === 0) return true
    const confirmed = await this.prisma.planReview.count({ where: { planId, status: 'CONFIRMED' } })
    return total === confirmed
  }

  approve(id: number, approvedById: number, vaultPath: string) {
    return this.prisma.planReport.update({
      where: { id },
      data: { status: 'APPROVED', approvedById, approvedAt: new Date(), vaultPath },
      include: PLAN_INCLUDE,
    })
  }

  reject(id: number, approvedById: number, reason: string) {
    return this.prisma.planReport.update({
      where: { id },
      data: { status: 'DRAFT', approvedById, rejectedAt: new Date(), rejectionReason: reason },
      include: PLAN_INCLUDE,
    })
  }

  submitResult(id: number, resultContent: string) {
    return this.prisma.planReport.update({
      where: { id },
      data: { resultContent, resultSubmittedAt: new Date() },
      include: PLAN_INCLUDE,
    })
  }

  getClubSettings() {
    return this.prisma.clubSettings.findUniqueOrThrow({ where: { id: 1 } })
  }

  findByIdLight(id: number) {
    return this.prisma.planReport.findUnique({
      where: { id },
      select: { id: true, status: true, templateType: true, departmentId: true, title: true, jobPosting: { select: { id: true } } },
    })
  }

  findApprovedHrReports() {
    return this.prisma.planReport.findMany({
      where: { status: 'APPROVED', templateType: 'HR', jobPosting: null },
      select: { id: true, title: true, departmentId: true, department: { select: { id: true, name: true } }, approvedAt: true },
      orderBy: { approvedAt: 'desc' },
    })
  }
}

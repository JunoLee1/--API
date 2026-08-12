import { AppError } from '../lib/appError'
import { canApprovePlan } from '../lib/permissions'
import { PlanReportRepository, ReviewerDeptMap } from './plan-report.repo'
import { CreatePlanReportDto, ListPlanReportQuery, UpdatePlanReportDto } from './dto/plan-report.dto'
import { writeApprovalVaultNote, appendResultToVaultNote, VaultPlanData } from './vault'

export class PlanReportService {
  constructor(private repo: PlanReportRepository) {}

  list(filters: ListPlanReportQuery) {
    return this.repo.findAll(filters)
  }

  async getById(id: number) {
    const plan = await this.repo.findById(id)
    if (!plan) throw new AppError(404, 'PLAN_REPORT_NOT_FOUND')
    return plan
  }

  create(dto: CreatePlanReportDto, createdById: number) {
    return this.repo.create(dto, createdById)
  }

  async update(id: number, dto: UpdatePlanReportDto) {
    const plan = await this.getById(id)
    if (plan.status === 'APPROVED') throw new AppError(409, 'CANNOT_MODIFY_APPROVED_PLAN')
    return this.repo.update(id, dto)
  }

  async submit(id: number, userId: number) {
    const plan = await this.getById(id)
    if (plan.status !== 'DRAFT') throw new AppError(409, 'CANNOT_SUBMIT_NON_DRAFT')
    if (plan.department.headId !== userId) throw new AppError(403, 'ONLY_HEAD_CAN_SUBMIT')

    const settings = await this.repo.getClubSettings()
    const deptMap = (settings.reviewerDeptMap ?? {}) as ReviewerDeptMap

    const reviewerDeptIds = resolveReviewerDeptIds(plan, deptMap)
    const requiredApproverLevel = resolveApproverLevel(plan.budget, plan.isNewBusiness, settings.planApprovalLimit)

    return this.repo.submit(id, reviewerDeptIds, requiredApproverLevel)
  }

  async approve(id: number, userId: number, userRole: string) {
    const plan = await this.getById(id)
    if (plan.status !== 'REVIEWING') throw new AppError(409, 'CANNOT_APPROVE_NON_REVIEWING')
    if (!canApprovePlan(userRole, plan.requiredApproverLevel)) throw new AppError(403, 'FORBIDDEN')

    const allComplete = await this.repo.allReviewsComplete(id)
    if (!allComplete) throw new AppError(409, 'REVIEWS_NOT_COMPLETE')

    const vaultData = toVaultData(plan)
    const vaultPath = await writeApprovalVaultNote(vaultData)
    return this.repo.approve(id, userId, vaultPath)
  }

  async reject(id: number, userId: number, userRole: string, reason: string) {
    if (!canApprovePlan(userRole, 'HEAD')) throw new AppError(403, 'FORBIDDEN')
    if (!reason?.trim()) throw new AppError(400, 'REJECTION_REASON_REQUIRED')
    const plan = await this.getById(id)
    if (plan.status !== 'REVIEWING') throw new AppError(409, 'CANNOT_REJECT_NON_REVIEWING')
    return this.repo.reject(id, userId, reason)
  }

  listApprovedHrReports() {
    return this.repo.findApprovedHrReports()
  }

  async submitResult(id: number, userId: number, resultContent: string) {
    if (!resultContent?.trim()) throw new AppError(400, 'RESULT_CONTENT_REQUIRED')
    const plan = await this.getById(id)
    if (plan.status !== 'APPROVED') throw new AppError(409, 'PLAN_NOT_APPROVED')

    const updated = await this.repo.submitResult(id, resultContent)

    if (plan.vaultPath) {
      await appendResultToVaultNote(plan.vaultPath, {
        content: resultContent,
        submittedAt: new Date(),
        submittedByUsername: plan.createdBy.username,
      })
    }

    return updated
  }
}

function resolveApproverLevel(budget: number, isNewBusiness: boolean, limit: number): string | null {
  if (isNewBusiness) return 'ADMIN'
  if (budget > limit) return 'GM'
  return null
}

function resolveReviewerDeptIds(
  plan: { hasNewStaff: boolean; hasContract: boolean; hasExternalLease: boolean; hasPersonalInfo: boolean },
  deptMap: ReviewerDeptMap
): number[] {
  const ids = new Set<number>()
  if (plan.hasNewStaff && deptMap.hr) ids.add(deptMap.hr)
  if (plan.hasContract) {
    if (deptMap.procurement) ids.add(deptMap.procurement)
    if (deptMap.legal) ids.add(deptMap.legal)
  }
  if (plan.hasExternalLease) {
    if (deptMap.facility) ids.add(deptMap.facility)
    if (deptMap.legal) ids.add(deptMap.legal)
  }
  if (plan.hasPersonalInfo) {
    if (deptMap.legal) ids.add(deptMap.legal)
    if (deptMap.privacy) ids.add(deptMap.privacy)
  }
  return Array.from(ids)
}

function toVaultData(plan: any): VaultPlanData {
  return {
    id: plan.id,
    title: plan.title,
    templateType: plan.templateType,
    departmentName: plan.department.name,
    budget: plan.budget,
    purpose: plan.purpose,
    expectedEffect: plan.expectedEffect,
    risks: plan.risks,
    attachments: plan.attachments,
    startDate: plan.startDate,
    endDate: plan.endDate,
    resultDueDate: plan.resultDueDate,
    approvedAt: new Date(),
    approvedByUsername: plan.approvedBy?.username ?? 'system',
    reviews: plan.reviews
      .filter((r: any) => r.status === 'CONFIRMED')
      .map((r: any) => ({
        deptName: r.reviewerDept.name,
        confirmedByUsername: r.confirmedBy?.username ?? '',
        confirmedAt: r.confirmedAt ?? new Date(),
      })),
    extraFields: plan.extraFields as Record<string, unknown> | null,
  }
}

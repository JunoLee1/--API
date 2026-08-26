import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { PlanReportService } from '../../src/plan-report/plan-report.service'
import { PlanReportRepository } from '../../src/plan-report/plan-report.repo'

const mockRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  getClubSettings: jest.fn(),
  submit: jest.fn(),
  findRulesByType: jest.fn(),
  findDeptsByCategory: jest.fn(),
  submitWithReviews: jest.fn(),
  allReviewsComplete: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  submitResult: jest.fn(),
  findApprovedHrReports: jest.fn(),
} as any

const mockNotifRepo = {
  createForHrManager: jest.fn(),
} as any

const service = new PlanReportService(mockRepo, mockNotifRepo)

beforeEach(() => jest.clearAllMocks())

// A helper that sets up a minimal DRAFT plan with the given overrides
function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: 'DRAFT',
    title: '테스트 계획서',
    templateType: 'GENERAL',
    budget: 0,
    isNewBusiness: false,
    hasNewStaff: false,
    hasContract: false,
    hasExternalLease: false,
    hasPersonalInfo: false,
    department: { id: 10, name: '운영팀', headId: 7 },
    ...overrides,
  }
}

describe('submit — HR templateType은 항상 ADMIN 승인 레벨이어야 한다', () => {
  test('templateType이 HR이면 requiredApproverLevel로 ADMIN을 전달한다', async () => {
    mockRepo.findById.mockResolvedValue(makePlan({ templateType: 'HR' }))
    mockRepo.getClubSettings.mockResolvedValue({
      reviewerDeptMap: {},
      planApprovalLimit: 5_000_000,
    })
    mockRepo.submit.mockResolvedValue({ id: 1, status: 'REVIEWING' })

    // userId 7 matches headId 7
    await service.submit(1, 7)

    expect(mockRepo.submit).toHaveBeenCalledWith(
      1,
      expect.any(Array),
      'ADMIN'
    )
  })
})

describe('submit — GENERAL 예산 초과 시 GM 승인 레벨', () => {
  test('templateType이 GENERAL이고 예산이 한도 초과이면 requiredApproverLevel로 GM을 전달한다', async () => {
    mockRepo.findById.mockResolvedValue(
      makePlan({ templateType: 'GENERAL', budget: 10_000_000, isNewBusiness: false })
    )
    mockRepo.getClubSettings.mockResolvedValue({
      reviewerDeptMap: {},
      planApprovalLimit: 5_000_000,
    })
    mockRepo.submit.mockResolvedValue({ id: 1, status: 'REVIEWING' })

    await service.submit(1, 7)

    expect(mockRepo.submit).toHaveBeenCalledWith(
      1,
      expect.any(Array),
      'GM'
    )
  })
})

describe('PlanReportRepository.findApprovedHrReports', () => {
  const makePrismaMock = (findManyResult: any[] = []) => ({
    planReport: {
      findMany: jest.fn().mockResolvedValue(findManyResult),
    },
  } as any)

  test('HR + APPROVED + no HiringPlanItems 인 계획서 반환', async () => {
    const prisma = makePrismaMock([
      { id: 1, title: 'legacy plan', departmentId: 10, department: { id: 10, name: '코칭' }, approvedAt: new Date() },
    ])
    const repo = new PlanReportRepository(prisma)
    const result = await repo.findApprovedHrReports()

    expect(result).toHaveLength(1)
    expect(prisma.planReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'APPROVED',
          templateType: 'HR',
          OR: expect.arrayContaining([
            { hiringPlanItems: { none: {} } },
            { hiringPlanItems: { some: { jobPostings: { none: {} } } } },
          ]),
        }),
      }),
    )
  })

  test('query 는 미완료 HiringPlanItem 조건을 포함해야 함 (regression)', async () => {
    const prisma = makePrismaMock([])
    const repo = new PlanReportRepository(prisma)
    await repo.findApprovedHrReports()

    const call = (prisma.planReport.findMany as jest.Mock).mock.calls[0][0] as any
    // OR 안에 정확히 2개 조건이 있어야 함
    expect(call.where.OR).toHaveLength(2)
    expect(call.where.OR).toContainEqual({ hiringPlanItems: { none: {} } })
    expect(call.where.OR).toContainEqual({ hiringPlanItems: { some: { jobPostings: { none: {} } } } })
  })

  test('fully-completed PlanReport 는 제외되어야 함 (regression: OR predicate 는 미완료 잔여 검사)', async () => {
    const prisma = makePrismaMock([])
    const repo = new PlanReportRepository(prisma)
    await repo.findApprovedHrReports()

    const call = (prisma.planReport.findMany as jest.Mock).mock.calls[0][0] as any
    // "some HiringPlanItem 이 미연결 JobPosting" 절이 반드시 있어야 fully-completed 는 배제됨
    expect(call.where.OR).toContainEqual({
      hiringPlanItems: { some: { jobPostings: { none: {} } } },
    })
    // legacy "no HiringPlanItems" 절도 유지되어야 함
    expect(call.where.OR).toContainEqual({ hiringPlanItems: { none: {} } })
  })
})

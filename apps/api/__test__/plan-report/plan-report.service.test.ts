import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { PlanReportService } from '../../src/plan-report/plan-report.service'

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

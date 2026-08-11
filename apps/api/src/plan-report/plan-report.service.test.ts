import { PlanReportService } from './plan-report.service'
import type { PlanReportRepository, ReviewerDeptMap } from './plan-report.repo'
import * as vault from './vault'

jest.mock('./vault')
const mockVault = vault as jest.Mocked<typeof vault>

const makeRepo = (overrides: Partial<PlanReportRepository> = {}): PlanReportRepository =>
  ({
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    submit: jest.fn(),
    allReviewsComplete: jest.fn().mockResolvedValue(true),
    approve: jest.fn(),
    reject: jest.fn(),
    submitResult: jest.fn(),
    getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: null }),
    ...overrides,
  } as unknown as PlanReportRepository)

const fakeDate = new Date('2026-08-10')

const fakePlan = (overrides = {}) => ({
  id: 1,
  title: '캠페인',
  purpose: '팬 유치',
  departmentId: 1,
  department: { id: 1, name: '마케팅', headId: 10 },
  startDate: fakeDate,
  endDate: fakeDate,
  budget: 5_000_000,
  expectedEffect: '관중 증가',
  risks: '날씨',
  attachments: [],
  resultDueDate: fakeDate,
  templateType: 'MARKETING',
  extraFields: null,
  hasNewStaff: false,
  hasContract: false,
  hasExternalLease: false,
  hasPersonalInfo: false,
  isNewBusiness: false,
  status: 'DRAFT',
  requiredApproverLevel: null,
  rejectionReason: null,
  resultContent: null,
  resultSubmittedAt: null,
  submittedAt: null,
  approvedAt: fakeDate,
  rejectedAt: null,
  vaultPath: null,
  createdById: 10,
  approvedById: null,
  createdBy: { id: 10, username: 'head' },
  approvedBy: null,
  reviews: [],
  ...overrides,
})

describe('getById', () => {
  it('존재하지 않으면 404', async () => {
    const svc = new PlanReportService(makeRepo())
    await expect(svc.getById(999)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('submit', () => {
  it('DRAFT가 아니면 409', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.submit(1, 10)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('부서장이 아니면 403', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan()) })
    const svc = new PlanReportService(repo)
    await expect(svc.submit(1, 999)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('예산이 전결한도 초과하면 requiredApproverLevel=GM', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ budget: 20_000_000 })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: null }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, [], 'GM')
  })

  it('신규사업이면 requiredApproverLevel=ADMIN', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ isNewBusiness: true })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: null }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, [], 'ADMIN')
  })

  it('예산초과+신규사업이면 ADMIN이 우선', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ budget: 20_000_000, isNewBusiness: true })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: null }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, [], 'ADMIN')
  })

  it('hasNewStaff이면 HR 부서가 reviewer에 추가된다', async () => {
    const deptMap: ReviewerDeptMap = { hr: 5 }
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ hasNewStaff: true })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: deptMap }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, [5], null)
  })

  it('hasContract이면 구매+법무 부서가 reviewer에 추가된다', async () => {
    const deptMap: ReviewerDeptMap = { procurement: 2, legal: 3 }
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ hasContract: true })),
      getClubSettings: jest.fn().mockResolvedValue({ planApprovalLimit: 10_000_000, reviewerDeptMap: deptMap }),
      submit: jest.fn().mockResolvedValue(fakePlan()),
    })
    const svc = new PlanReportService(repo)
    await svc.submit(1, 10)
    expect(repo.submit).toHaveBeenCalledWith(1, expect.arrayContaining([2, 3]), null)
  })
})

describe('approve', () => {
  it('REVIEWING이 아니면 409', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'DRAFT' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.approve(1, 10, 'ADMIN')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('requiredApproverLevel=ADMIN인데 GM이 승인하면 403', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING', requiredApproverLevel: 'ADMIN' })),
    })
    const svc = new PlanReportService(repo)
    await expect(svc.approve(1, 10, 'GM')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('리뷰 미완료이면 409', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })),
      allReviewsComplete: jest.fn().mockResolvedValue(false),
    })
    const svc = new PlanReportService(repo)
    await expect(svc.approve(1, 10, 'ADMIN')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('승인 성공 시 vault 노트를 생성한다', async () => {
    const plan = fakePlan({ status: 'REVIEWING' })
    mockVault.writeApprovalVaultNote.mockResolvedValue('/vault/2026/plan.md')
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(plan),
      allReviewsComplete: jest.fn().mockResolvedValue(true),
      approve: jest.fn().mockResolvedValue(plan),
    })
    const svc = new PlanReportService(repo)
    await svc.approve(1, 10, 'ADMIN')
    expect(mockVault.writeApprovalVaultNote).toHaveBeenCalled()
    expect(repo.approve).toHaveBeenCalledWith(1, 10, '/vault/2026/plan.md')
  })
})

describe('reject', () => {
  it('사유 없으면 400', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.reject(1, 10, 'ADMIN', '')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('FRONT_OFFICE 역할이 거절하면 403', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.reject(1, 10, 'FRONT_OFFICE', '사유')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('REVIEWING이 아니면 409', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'DRAFT' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.reject(1, 10, 'ADMIN', '사유')).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('submitResult', () => {
  it('resultContent가 비어있으면 400', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'APPROVED' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.submitResult(1, 10, '')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('APPROVED가 아니면 409', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fakePlan({ status: 'REVIEWING' })) })
    const svc = new PlanReportService(repo)
    await expect(svc.submitResult(1, 10, '결과내용')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('결과 제출 성공 시 vault 노트를 업데이트한다', async () => {
    const plan = fakePlan({ status: 'APPROVED', vaultPath: '/vault/2026/plan.md', createdById: 10 })
    mockVault.appendResultToVaultNote.mockResolvedValue(undefined)
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(plan),
      submitResult: jest.fn().mockResolvedValue(plan),
    })
    const svc = new PlanReportService(repo)
    await svc.submitResult(1, 10, '결과내용')
    expect(mockVault.appendResultToVaultNote).toHaveBeenCalledWith('/vault/2026/plan.md', expect.objectContaining({ content: '결과내용' }))
  })
})

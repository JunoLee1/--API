import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { HiringSurveyService } from '../../src/hiring-survey/hiring-survey.service'

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  close: jest.fn(),
  findOpenPastDeadline: jest.fn(),
  findOpenNearDeadline: jest.fn(),
  upsertResponse: jest.fn(),
  findResponsesBySurvey: jest.fn(),
} as any

const mockPlanReportRepo = {
  createDraftForSurvey: jest.fn(),
  createHiringPlanItems: jest.fn(),
} as any

const mockNotifRepo = {
  create: jest.fn(),
  createForHrManager: jest.fn(),
} as any

const service = new HiringSurveyService(mockRepo, mockPlanReportRepo, mockNotifRepo)

beforeEach(() => jest.clearAllMocks())

describe('create', () => {
  test('targetDeptIds가 비어있으면 400 TARGET_DEPTS_REQUIRED를 던진다', async () => {
    await expect(
      service.create({ title: '2027 채용 조사', deadlineAt: '2027-01-31', targetDeptIds: [] }, 1)
    ).rejects.toMatchObject({ statusCode: 400, code: 'TARGET_DEPTS_REQUIRED' })
  })

  test('조사 생성 후 대상 부서장에게 알림을 보낸다', async () => {
    mockRepo.create.mockResolvedValue({
      id: 1,
      title: '2027 채용 조사',
      targetDepartments: [
        { department: { headId: 10 } },
        { department: { headId: 20 } },
      ],
    })
    mockNotifRepo.create.mockResolvedValue({})

    await service.create({ title: '2027 채용 조사', deadlineAt: '2027-01-31', targetDeptIds: [1, 2] }, 5)

    expect(mockNotifRepo.create).toHaveBeenCalledTimes(2)
    expect(mockNotifRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, type: 'HIRING_SURVEY_OPEN' })
    )
  })
})

describe('submitResponse', () => {
  test('CLOSED 조사에 응답하면 409 SURVEY_NOT_OPEN을 던진다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'CLOSED',
      targetDepartments: [],
      responses: [],
    })

    await expect(
      service.submitResponse(1, 10, { roleTitle: '코치', headcount: 1, priority: 'HIGH', reason: '공백' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'SURVEY_NOT_OPEN' })
  })

  test('대상 부서 headId가 아닌 유저는 403 NOT_TARGET_DEPARTMENT_HEAD를 던진다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'OPEN',
      targetDepartments: [{ departmentId: 5, department: { headId: 99 } }],
      responses: [],
    })

    await expect(
      service.submitResponse(1, 10, { roleTitle: '코치', headcount: 1, priority: 'HIGH', reason: '공백' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_TARGET_DEPARTMENT_HEAD' })
  })

  test('정상 응답 시 upsertResponse를 호출한다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'OPEN',
      targetDepartments: [{ departmentId: 5, department: { headId: 10 } }],
      responses: [],
    })
    mockRepo.upsertResponse.mockResolvedValue({ id: 1 })

    await service.submitResponse(1, 10, { roleTitle: '코치', headcount: 2, priority: 'HIGH', reason: '공백' })

    expect(mockRepo.upsertResponse).toHaveBeenCalledWith(1, 5, 10, expect.objectContaining({ roleTitle: '코치' }))
  })
})

describe('close', () => {
  test('이미 CLOSED된 조사를 닫으면 409 SURVEY_NOT_OPEN을 던진다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'CLOSED',
      title: '조사',
      targetDepartments: [],
      responses: [],
    })

    await expect(service.close(1, 5)).rejects.toMatchObject({ statusCode: 409, code: 'SURVEY_NOT_OPEN' })
  })

  test('close 시 PlanReport DRAFT와 HiringPlanItem을 생성한다', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'OPEN',
      title: '2027 채용 조사',
      targetDepartments: [],
      responses: [],
    })
    mockRepo.close.mockResolvedValue({})
    mockRepo.findResponsesBySurvey.mockResolvedValue([
      { id: 10, roleTitle: '피지컬 코치', headcount: 1, quarter: 1, priority: 'HIGH', estimatedBudget: null },
    ])
    mockPlanReportRepo.createDraftForSurvey.mockResolvedValue({ id: 99 })
    mockPlanReportRepo.createHiringPlanItems.mockResolvedValue({})
    mockNotifRepo.createForHrManager.mockResolvedValue(undefined)

    await service.close(1, 5)

    expect(mockPlanReportRepo.createDraftForSurvey).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: 1 })
    )
    expect(mockPlanReportRepo.createHiringPlanItems).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ planReportId: 99, roleTitle: '피지컬 코치' })])
    )
    expect(mockNotifRepo.createForHrManager).toHaveBeenCalledWith(
      'HIRING_SURVEY_CLOSED',
      expect.any(Function),
      1
    )
  })
})

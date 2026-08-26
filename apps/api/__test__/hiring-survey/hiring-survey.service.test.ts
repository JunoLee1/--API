import { describe, test, it, expect, jest, beforeEach } from '@jest/globals'
import { HiringSurveyService } from '../../src/hiring-survey/hiring-survey.service'
import type { HiringSurveyRepository } from '../../src/hiring-survey/hiring-survey.repo'
import type { PlanReportRepository } from '../../src/plan-report/plan-report.repo'
import type { NotificationRepository } from '../../src/notification/notification.repo'

const makeSurveyRepo = (overrides: Partial<HiringSurveyRepository> = {}): HiringSurveyRepository =>
  ({
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    close: jest.fn(),
    findOpenPastDeadline: jest.fn().mockResolvedValue([]),
    findOpenNearDeadline: jest.fn().mockResolvedValue([]),
    upsertResponse: jest.fn(),
    findResponsesBySurvey: jest.fn().mockResolvedValue([]),
    createDraft: jest.fn(),
    updateDraft: jest.fn(),
    openDraft: jest.fn(),
    deleteDraft: jest.fn(),
    ...overrides,
  } as unknown as HiringSurveyRepository)

const makePlanRepo = (): PlanReportRepository =>
  ({
    createDraftForSurvey: jest.fn(),
    createHiringPlanItems: jest.fn(),
  } as unknown as PlanReportRepository)

const makeNotifRepo = (): NotificationRepository =>
  ({
    create: jest.fn().mockResolvedValue({}),
    createForHrManager: jest.fn().mockResolvedValue({}),
    createForUsers: jest.fn().mockResolvedValue({}),
  } as unknown as NotificationRepository)

const makeSvc = (repoOverrides: Partial<HiringSurveyRepository> = {}) =>
  new HiringSurveyService(makeSurveyRepo(repoOverrides), makePlanRepo(), makeNotifRepo())

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

describe('HiringSurveyService.updateDraft', () => {
  const draftSurvey = {
    id: 1,
    title: '2026 Q4 채용 수요 조사',
    deadlineAt: new Date('2026-12-31T23:59:59Z'),
    status: 'DRAFT' as const,
    createdById: 1,
    targetDepartments: [{ department: { id: 10, name: '코칭', headId: 100 } }],
    responses: [],
  }

  it('DRAFT 상태에서 title/deadlineAt/targetDeptIds 편집 가능', async () => {
    const updateDraft = jest.fn().mockResolvedValue({ ...draftSurvey, title: '수정됨' })
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(draftSurvey),
      updateDraft,
    })

    const result = await svc.updateDraft(1, { title: '수정됨', targetDeptIds: [20] })

    expect(updateDraft).toHaveBeenCalledWith(1, { title: '수정됨', targetDeptIds: [20] })
    expect(result.title).toBe('수정됨')
  })

  it('OPEN 상태의 survey 는 편집 불가 → 409 SURVEY_NOT_DRAFT', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, status: 'OPEN' }),
    })

    await expect(svc.updateDraft(1, { title: '수정 시도' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'SURVEY_NOT_DRAFT',
    })
  })

  it('없는 survey 는 404 SURVEY_NOT_FOUND', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(null),
    })

    await expect(svc.updateDraft(999, { title: 'x' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'SURVEY_NOT_FOUND',
    })
  })

  it('deadlineAt string 은 Date 로 변환', async () => {
    const updateDraft = jest.fn().mockResolvedValue(draftSurvey)
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(draftSurvey),
      updateDraft,
    })

    await svc.updateDraft(1, { deadlineAt: '2027-01-15T00:00:00Z' })

    const callArg = updateDraft.mock.calls[0][1]
    expect(callArg.deadlineAt).toBeInstanceOf(Date)
    expect((callArg.deadlineAt as Date).toISOString()).toBe('2027-01-15T00:00:00.000Z')
  })
})

describe('HiringSurveyService.open', () => {
  const draftSurvey = {
    id: 1,
    title: '2026 Q4 채용 수요 조사',
    deadlineAt: new Date('2026-12-31T23:59:59Z'),
    status: 'DRAFT' as const,
    createdById: 1,
    targetDepartments: [
      { department: { id: 10, name: '코칭', headId: 100 } },
      { department: { id: 20, name: '의료', headId: 200 } },
    ],
    responses: [],
  }

  it('DRAFT → OPEN 전이 시 대상 부서장들에게 HIRING_SURVEY_OPEN 알림', async () => {
    const openDraft = jest.fn().mockResolvedValue({ ...draftSurvey, status: 'OPEN' })
    const notifCreate = jest.fn().mockResolvedValue({})
    const notifRepo = {
      create: notifCreate,
      createForHrManager: jest.fn(),
      createForUsers: jest.fn(),
    } as unknown as NotificationRepository

    const svc = new HiringSurveyService(
      makeSurveyRepo({
        findById: jest.fn().mockResolvedValue(draftSurvey),
        openDraft,
      }),
      makePlanRepo(),
      notifRepo,
    )

    const result = await svc.open(1)

    expect(openDraft).toHaveBeenCalledWith(1)
    expect(result.status).toBe('OPEN')
    // 부서장 2명에게 알림
    expect(notifCreate).toHaveBeenCalledTimes(2)
    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 100, type: 'HIRING_SURVEY_OPEN' })
    )
    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 200, type: 'HIRING_SURVEY_OPEN' })
    )
  })

  it('DRAFT 아니면 409 SURVEY_NOT_DRAFT', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, status: 'OPEN' }),
    })

    await expect(svc.open(1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'SURVEY_NOT_DRAFT',
    })
  })

  it('대상 부서 없으면 409 TARGET_DEPTS_REQUIRED', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, targetDepartments: [] }),
    })

    await expect(svc.open(1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'TARGET_DEPTS_REQUIRED',
    })
  })

  it('deadlineAt 과거면 409 DEADLINE_IN_PAST', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, deadlineAt: new Date('2020-01-01') }),
    })

    await expect(svc.open(1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'DEADLINE_IN_PAST',
    })
  })
})

describe('HiringSurveyService.deleteDraft', () => {
  const draftSurvey = {
    id: 1,
    title: '2026 Q4 채용 수요 조사',
    deadlineAt: new Date('2026-12-31T23:59:59Z'),
    status: 'DRAFT' as const,
    createdById: 1,
    targetDepartments: [],
    responses: [],
  }

  it('DRAFT 상태 삭제 성공', async () => {
    const deleteDraft = jest.fn().mockResolvedValue({ id: 1 })
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(draftSurvey),
      deleteDraft,
    })

    await svc.deleteDraft(1)

    expect(deleteDraft).toHaveBeenCalledWith(1)
  })

  it('DRAFT 아니면 409 SURVEY_NOT_DRAFT', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue({ ...draftSurvey, status: 'OPEN' }),
    })

    await expect(svc.deleteDraft(1)).rejects.toMatchObject({
      statusCode: 409,
      message: 'SURVEY_NOT_DRAFT',
    })
  })

  it('없는 survey 는 404', async () => {
    const svc = makeSvc({
      findById: jest.fn().mockResolvedValue(null),
    })

    await expect(svc.deleteDraft(999)).rejects.toMatchObject({
      statusCode: 404,
      message: 'SURVEY_NOT_FOUND',
    })
  })
})

describe('HiringSurveyService.createQuarterlyDraft', () => {
  const targetDeptIds = [10, 20, 30]

  it('DRAFT status 로 survey 생성 + HR 매니저에게 HIRING_SURVEY_DRAFT_CREATED 알림', async () => {
    const createDraft = jest.fn().mockResolvedValue({
      id: 42,
      title: '2026 Q4 채용 수요 조사',
      status: 'DRAFT',
      targetDepartments: targetDeptIds.map((id) => ({ department: { id, name: 'x', headId: null } })),
    })
    const notifHrCreate = jest.fn().mockResolvedValue({})
    const notifRepo = {
      create: jest.fn(),
      createForHrManager: notifHrCreate,
      createForUsers: jest.fn(),
    } as unknown as NotificationRepository

    const svc = new HiringSurveyService(
      makeSurveyRepo({ createDraft }),
      makePlanRepo(),
      notifRepo,
    )

    const result = await svc.createQuarterlyDraft({
      title: '2026 Q4 채용 수요 조사',
      deadlineAt: new Date('2026-12-31T23:59:59Z'),
      targetDeptIds,
      systemUserId: 1,
    })

    expect(createDraft).toHaveBeenCalledWith({
      title: '2026 Q4 채용 수요 조사',
      deadlineAt: new Date('2026-12-31T23:59:59Z'),
      targetDeptIds,
      createdById: 1,
    })
    expect(result.id).toBe(42)
    expect(notifHrCreate).toHaveBeenCalledWith(
      'HIRING_SURVEY_DRAFT_CREATED',
      expect.any(Function),
      42,
    )
  })

  it('targetDeptIds 비어있으면 400 TARGET_DEPTS_REQUIRED (defensive)', async () => {
    const svc = makeSvc()
    await expect(
      svc.createQuarterlyDraft({
        title: 'x',
        deadlineAt: new Date(),
        targetDeptIds: [],
        systemUserId: 1,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: 'TARGET_DEPTS_REQUIRED' })
  })

  it('title 없으면 400 TITLE_REQUIRED', async () => {
    const svc = makeSvc()
    await expect(
      svc.createQuarterlyDraft({
        title: '',
        deadlineAt: new Date(),
        targetDeptIds: [10],
        systemUserId: 1,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: 'TITLE_REQUIRED' })
  })

  it('deadlineAt 없으면 400 DEADLINE_REQUIRED', async () => {
    const svc = makeSvc()
    await expect(
      svc.createQuarterlyDraft({
        title: 'x',
        deadlineAt: undefined as any,
        targetDeptIds: [10],
        systemUserId: 1,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: 'DEADLINE_REQUIRED' })
  })
})

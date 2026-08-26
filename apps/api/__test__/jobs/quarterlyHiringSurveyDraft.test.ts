import { describe, it, expect, jest } from '@jest/globals'
import { runQuarterlyHiringSurveyDraft } from '../../src/jobs/quarterlyHiringSurveyDraft'

describe('runQuarterlyHiringSurveyDraft', () => {
  it('active season + priority queue 결과로 draft 생성', async () => {
    const createQuarterlyDraft = jest.fn<any>().mockResolvedValue({ id: 42 })
    const computePriorityQueue = jest.fn<any>().mockResolvedValue({
      queue: [
        { departmentId: 10, departmentName: '코칭', highPriority: true },
        { departmentId: 20, departmentName: '의료', highPriority: false },
        { departmentId: 30, departmentName: 'FO', highPriority: false },
        { departmentId: 40, departmentName: '유소년', highPriority: false },
      ],
    })
    const findActiveSeason = jest.fn<any>().mockResolvedValue({ id: 1, leagueLevel: 'PROFESSIONAL' })
    const findClubSettings = jest.fn<any>().mockResolvedValue({ ibiBeta: 1.0, autoSurveyTopN: 3 })
    const findSystemUser = jest.fn<any>().mockResolvedValue({ id: 1 })
    const findHrManagerExists = jest.fn<any>().mockResolvedValue(true)

    const runAt = new Date('2026-10-01T09:00:00+09:00')

    await runQuarterlyHiringSurveyDraft({
      findActiveSeason,
      findClubSettings,
      findSystemUser,
      findHrManagerExists,
      computePriorityQueue,
      createQuarterlyDraft,
      now: () => runAt,
    })

    // computePriorityQueue 호출됨
    expect(computePriorityQueue).toHaveBeenCalledWith(
      { id: 1, leagueLevel: 'PROFESSIONAL' },
      1.0,
    )

    // createQuarterlyDraft 호출: title = "2026 Q4 채용 수요 조사"
    // targetDeptIds = TOP_3 + highPriority (dedup) = [10, 20, 30] (10 은 이미 top3 라 중복 제거됨)
    expect(createQuarterlyDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '2026 Q4 채용 수요 조사',
        targetDeptIds: [10, 20, 30],
        systemUserId: 1,
      })
    )

    // deadline 은 분기 마지막날 (Q4 → 12/31 23:59:59)
    const callArg = createQuarterlyDraft.mock.calls[0][0] as { deadlineAt: Date }
    const deadline = callArg.deadlineAt
    expect(deadline.getMonth()).toBe(11) // December (0-indexed)
    expect(deadline.getDate()).toBe(31)
  })

  it('active season 없으면 return (draft 생성 안 함)', async () => {
    const createQuarterlyDraft = jest.fn<any>()
    await runQuarterlyHiringSurveyDraft({
      findActiveSeason: jest.fn<any>().mockResolvedValue(null),
      findClubSettings: jest.fn<any>(),
      findSystemUser: jest.fn<any>(),
      findHrManagerExists: jest.fn<any>().mockResolvedValue(true),
      computePriorityQueue: jest.fn<any>(),
      createQuarterlyDraft,
      now: () => new Date('2026-10-01'),
    })
    expect(createQuarterlyDraft).not.toHaveBeenCalled()
  })

  it('HR_MANAGER 없으면 skip + warn (draft 만들지 않음)', async () => {
    const createQuarterlyDraft = jest.fn<any>()
    const warn = jest.fn<any>()
    await runQuarterlyHiringSurveyDraft({
      findActiveSeason: jest.fn<any>().mockResolvedValue({ id: 1, leagueLevel: 'PROFESSIONAL' }),
      findClubSettings: jest.fn<any>().mockResolvedValue({ ibiBeta: 1.0, autoSurveyTopN: 3 }),
      findSystemUser: jest.fn<any>().mockResolvedValue({ id: 1 }),
      findHrManagerExists: jest.fn<any>().mockResolvedValue(false),
      computePriorityQueue: jest.fn<any>(),
      createQuarterlyDraft,
      now: () => new Date('2026-10-01'),
      warn,
    })
    expect(createQuarterlyDraft).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('HR_MANAGER'))
  })

  it('systemUser (admin) 없으면 return (draft 생성 안 함)', async () => {
    const createQuarterlyDraft = jest.fn<any>()
    await runQuarterlyHiringSurveyDraft({
      findActiveSeason: jest.fn<any>().mockResolvedValue({ id: 1, leagueLevel: 'PROFESSIONAL' }),
      findClubSettings: jest.fn<any>().mockResolvedValue({ ibiBeta: 1.0, autoSurveyTopN: 3 }),
      findSystemUser: jest.fn<any>().mockResolvedValue(null),
      findHrManagerExists: jest.fn<any>().mockResolvedValue(true),
      computePriorityQueue: jest.fn<any>().mockResolvedValue({ queue: [{ departmentId: 10, departmentName: 'x', highPriority: false }] }),
      createQuarterlyDraft,
      now: () => new Date('2026-01-01'),
    })
    expect(createQuarterlyDraft).not.toHaveBeenCalled()
  })

  it('autoSurveyTopN null 이면 default 3', async () => {
    const createQuarterlyDraft = jest.fn<any>().mockResolvedValue({ id: 42 })
    await runQuarterlyHiringSurveyDraft({
      findActiveSeason: jest.fn<any>().mockResolvedValue({ id: 1, leagueLevel: 'PROFESSIONAL' }),
      findClubSettings: jest.fn<any>().mockResolvedValue({ ibiBeta: 1.0, autoSurveyTopN: null }),
      findSystemUser: jest.fn<any>().mockResolvedValue({ id: 1 }),
      findHrManagerExists: jest.fn<any>().mockResolvedValue(true),
      computePriorityQueue: jest.fn<any>().mockResolvedValue({
        queue: [
          { departmentId: 10, departmentName: 'x', highPriority: false },
          { departmentId: 20, departmentName: 'x', highPriority: false },
          { departmentId: 30, departmentName: 'x', highPriority: false },
          { departmentId: 40, departmentName: 'x', highPriority: false },
        ],
      }),
      createQuarterlyDraft,
      now: () => new Date('2026-01-01'),
    })
    const targetIds = (createQuarterlyDraft.mock.calls[0][0] as { targetDeptIds: number[] }).targetDeptIds
    expect(targetIds.length).toBe(3) // default TOP_N=3
  })
})

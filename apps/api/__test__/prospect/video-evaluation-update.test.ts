import { ProspectService, computeVideoEvalResult } from '../../src/prospect/prospect.service'

const makeEval = (overrides = {}) => ({
  id: 99,
  prospectId: 1,
  qualityPassed: true,
  identifiable: true,
  continuity: true,
  jerseyNumber: null,
  totalScore: 75,
  scoreData: null,
  pipelineData: null,
  result: 'PASS',
  notes: null,
  evaluatedBy: { nickname: 'Scout' },
  evaluatedAt: new Date().toISOString(),
  ...overrides,
})

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST', visaRequired: false, visaEligibility: null }),
  getVideoEvaluations: jest.fn().mockResolvedValue([makeEval()]),
  updateVideoEvaluation: jest.fn().mockImplementation((_pid: number, _eid: number, dto: Record<string, unknown>, result: string) =>
    Promise.resolve({ ...makeEval(), ...dto, result }),
  ),
  ...overrides,
})

describe('ProspectService.updateVideoEvaluation', () => {
  it('totalScore 변경 시 result 재계산 (PASS → PENDING)', async () => {
    const repo = makeRepo() as any
    const svc = new ProspectService(repo)
    const result = await svc.updateVideoEvaluation(1, 99, { totalScore: 60 })
    expect(repo.updateVideoEvaluation).toHaveBeenCalledWith(1, 99, { totalScore: 60 }, 'PENDING')
    expect(result.result).toBe('PENDING')
  })

  it('gate 하나라도 false면 result = FAIL', async () => {
    const repo = makeRepo() as any
    const svc = new ProspectService(repo)
    await svc.updateVideoEvaluation(1, 99, { qualityPassed: false })
    expect(repo.updateVideoEvaluation).toHaveBeenCalledWith(1, 99, { qualityPassed: false }, 'FAIL')
  })

  it('evalId가 해당 prospect에 없으면 VIDEO_EVAL_NOT_FOUND', async () => {
    const repo = makeRepo({ getVideoEvaluations: jest.fn().mockResolvedValue([makeEval({ id: 50 })]) }) as any
    const svc = new ProspectService(repo)
    await expect(svc.updateVideoEvaluation(1, 99, {})).rejects.toMatchObject({ message: 'VIDEO_EVAL_NOT_FOUND' })
  })

  it('prospect가 없거나 다른 club이면 PROSPECT_NOT_FOUND', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) }) as any
    const svc = new ProspectService(repo)
    await expect(svc.updateVideoEvaluation(1, 99, {}, 999)).rejects.toMatchObject({ message: 'PROSPECT_NOT_FOUND' })
  })
})

describe('computeVideoEvalResult', () => {
  it('gate 미통과 → FAIL', () => {
    expect(computeVideoEvalResult(false, true, true, 80)).toBe('FAIL')
  })
  it('gate 통과 + score>=70 → PASS', () => {
    expect(computeVideoEvalResult(true, true, true, 70)).toBe('PASS')
  })
  it('gate 통과 + score<70 → PENDING', () => {
    expect(computeVideoEvalResult(true, true, true, 69)).toBe('PENDING')
  })
  it('gate 통과 + score null → PENDING', () => {
    expect(computeVideoEvalResult(true, true, true, null)).toBe('PENDING')
  })
})

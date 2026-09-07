// apps/api/src/prospect/prospect.service.test.ts
import { ProspectService, computeVideoEvalResult } from './prospect.service';
import { AppError } from '../lib/appError';
import type { ProspectRepository } from './prospect.repo';

const makeRepo = (overrides: Partial<ProspectRepository> = {}): ProspectRepository => ({
  checkDuplicate: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn().mockResolvedValue({ id: 1, status: 'SHORTLIST' }),
  sign: jest.fn(),
  recordMedicalResult: jest.fn(),
  addNegotiationLog: jest.fn(),
  getNegotiationLogs: jest.fn(),
  addVideoEvaluation: jest.fn(),
  getVideoEvaluations: jest.fn(),
  getLatestVideoEvaluation: jest.fn(),
  addEvaluationLog: jest.fn(),
  getEvaluationLogs: jest.fn(),
  checkAcquisitionGate: jest.fn(),
  countByStatus: jest.fn().mockResolvedValue(0),  // 추가: 기본값 0 (정원 미초과)
  getForeignPlayerCount: jest.fn().mockResolvedValue({ leagueLevel: 'K_LEAGUE_1', count: 0 }),
  ...overrides,
} as unknown as ProspectRepository);

// ─── computeVideoEvalResult ──────────────────────────────────────────────────

describe('computeVideoEvalResult', () => {
  it('hard gate 하나라도 false면 FAIL', () => {
    expect(computeVideoEvalResult(false, true, true, 80)).toBe('FAIL');
    expect(computeVideoEvalResult(true, false, true, 80)).toBe('FAIL');
    expect(computeVideoEvalResult(true, true, false, 80)).toBe('FAIL');
  });

  it('hard gate 전부 true + totalScore >= 70이면 PASS', () => {
    expect(computeVideoEvalResult(true, true, true, 70)).toBe('PASS');
    expect(computeVideoEvalResult(true, true, true, 100)).toBe('PASS');
  });

  it('hard gate 전부 true + totalScore < 70이면 PENDING', () => {
    expect(computeVideoEvalResult(true, true, true, 69)).toBe('PENDING');
    expect(computeVideoEvalResult(true, true, true, 0)).toBe('PENDING');
  });

  it('hard gate 전부 true + totalScore null이면 PENDING', () => {
    expect(computeVideoEvalResult(true, true, true, null)).toBe('PENDING');
    expect(computeVideoEvalResult(true, true, true, undefined)).toBe('PENDING');
  });
});

// ─── ProspectService.updateStatus — SHORTLIST gate ──────────────────────────

describe('ProspectService.updateStatus — SHORTLIST gate', () => {
  it('최신 VideoEvaluation 없으면 VIDEO_EVAL_REQUIRED 400', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
      getLatestVideoEvaluation: jest.fn().mockResolvedValue(null),
    }));
    await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
      .rejects.toThrow(new AppError(400, 'VIDEO_EVAL_REQUIRED'));
  });

  it('최신 VideoEvaluation result가 FAIL이면 VIDEO_EVAL_REQUIRED 400', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
      getLatestVideoEvaluation: jest.fn().mockResolvedValue({ result: 'FAIL' }),
    }));
    await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
      .rejects.toThrow(new AppError(400, 'VIDEO_EVAL_REQUIRED'));
  });

  it('최신 VideoEvaluation result가 PENDING이면 VIDEO_EVAL_REQUIRED 400', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
      getLatestVideoEvaluation: jest.fn().mockResolvedValue({ result: 'PENDING' }),
    }));
    await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
      .rejects.toThrow(new AppError(400, 'VIDEO_EVAL_REQUIRED'));
  });

  it('최신 VideoEvaluation result가 PASS면 repo.updateStatus 호출', async () => {
    const updateStatus = jest.fn().mockResolvedValue({ id: 1, status: 'SHORTLIST' });
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
      getLatestVideoEvaluation: jest.fn().mockResolvedValue({ result: 'PASS' }),
      updateStatus,
    }));
    await service.updateStatus(1, { status: 'SHORTLIST' });
    expect(updateStatus).toHaveBeenCalledWith(1, 'SHORTLIST');
  });

  it('SHORTLIST 이외 전환은 VideoEval 체크 없이 진행', async () => {
    const getLatest = jest.fn();
    const service = new ProspectService(makeRepo({ getLatestVideoEvaluation: getLatest }));
    await service.updateStatus(1, { status: 'ARCHIVED' });
    expect(getLatest).not.toHaveBeenCalled();
  });

  it('LONGLIST에서 SHORTLIST 직행 시 MUST_GO_THROUGH_PRE_SHORTLIST 400', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'LONGLIST' }),
    }));
    await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
      .rejects.toThrow(new AppError(400, 'MUST_GO_THROUGH_PRE_SHORTLIST'));
  });

  it('SHORTLIST 정원 5명 초과 시 SHORTLIST_FULL 409', async () => {
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
      countByStatus: jest.fn().mockResolvedValue(5),
    }));
    await expect(service.updateStatus(1, { status: 'SHORTLIST' }))
      .rejects.toThrow(new AppError(409, 'SHORTLIST_FULL'));
  });

  it('PRE_SHORTLIST + 정원 미초과 + VIDEO_EVAL PASS면 repo.updateStatus 호출', async () => {
    const updateStatus = jest.fn().mockResolvedValue({ id: 1, status: 'SHORTLIST' });
    const service = new ProspectService(makeRepo({
      findById: jest.fn().mockResolvedValue({ id: 1, status: 'PRE_SHORTLIST' }),
      countByStatus: jest.fn().mockResolvedValue(4),
      getLatestVideoEvaluation: jest.fn().mockResolvedValue({ result: 'PASS' }),
      updateStatus,
    }));
    await service.updateStatus(1, { status: 'SHORTLIST' });
    expect(updateStatus).toHaveBeenCalledWith(1, 'SHORTLIST');
  });
});

// ─── ProspectService.sign — 외국인 쿼터 ─────────────────────────────────────

describe('ProspectService.sign — 외국인 쿼터', () => {
  it('workPermitStatus가 NOT_REQUIRED이면 쿼터 체크 없이 통과', async () => {
    const repo = makeRepo({ sign: jest.fn().mockResolvedValue({ name: '홍길동' }) });
    const service = new ProspectService(repo);
    await service.sign(1, { workPermitStatus: 'NOT_REQUIRED' } as any);
    expect(repo.getForeignPlayerCount).not.toHaveBeenCalled();
  });

  it('K리그1 쿼터 5명 초과 시 FOREIGN_QUOTA_EXCEEDED 409', async () => {
    const repo = makeRepo({
      getForeignPlayerCount: jest.fn().mockResolvedValue({ leagueLevel: 'K_LEAGUE_1', count: 5 }),
    });
    const service = new ProspectService(repo);
    await expect(
      service.sign(1, { workPermitStatus: 'PENDING' } as any)
    ).rejects.toMatchObject({ statusCode: 409, message: 'FOREIGN_QUOTA_EXCEEDED' });
  });

  it('K리그1 쿼터 4명이면 통과', async () => {
    const repo = makeRepo({
      getForeignPlayerCount: jest.fn().mockResolvedValue({ leagueLevel: 'K_LEAGUE_1', count: 4 }),
      sign: jest.fn().mockResolvedValue({ name: '외국인' }),
    });
    const service = new ProspectService(repo);
    await expect(service.sign(1, { workPermitStatus: 'PENDING' } as any)).resolves.toBeDefined();
  });
});

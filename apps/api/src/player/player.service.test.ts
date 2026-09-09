// apps/api/src/player/player.service.test.ts
import { PlayerService } from './player.service';
import { AppError } from '../lib/appError';
import type { PlayerRepository } from './player.repo';
import type { MarketValueRepository } from './market-value.repo';

const makeRepo = (overrides: Partial<PlayerRepository> = {}): PlayerRepository =>
  ({
    findAll: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    promotePlayer: jest.fn(),
    updateWorkPermit: jest.fn(),
    delete: jest.fn(),
    getMatchStats: jest.fn(),
    getTrainingResults: jest.fn(),
    getPositionDiversity: jest.fn(),
    ...overrides,
  } as unknown as PlayerRepository);

const makeMvRepo = (overrides: Partial<MarketValueRepository> = {}): MarketValueRepository =>
  ({
    getHistory: jest.fn(),
    updateCurrentValue: jest.fn(),
    ...overrides,
  } as unknown as MarketValueRepository);

const PLAYER_STUB = {
  id: 'p1',
  playerName: '홍길동',
  clubId: 10,
  teamId: 1,
  status: 'ACTIVE',
  team: { id: 1, type: 'FIRST_TEAM' },
  userId: 99,
};

// ─── updatePlayer ────────────────────────────────────────────────────────────

describe('PlayerService.updatePlayer — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(service.updatePlayer('p1', {}, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });

  it('같은 clubId면 repo.update 호출', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(PLAYER_STUB),
      update: jest.fn().mockResolvedValue(PLAYER_STUB),
    });
    const service = new PlayerService(repo);
    await service.updatePlayer('p1', { playerName: '김철수' }, 10);
    expect(repo.update).toHaveBeenCalledWith('p1', { playerName: '김철수' });
  });

  it('actorClubId 미전달(null)이면 clubId 필터 없이 처리', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(PLAYER_STUB),
      update: jest.fn().mockResolvedValue(PLAYER_STUB),
    });
    const service = new PlayerService(repo);
    await service.updatePlayer('p1', {}, null);
    expect(repo.findById).toHaveBeenCalledWith('p1', null);
  });
});

// ─── updatePlayerStatus ──────────────────────────────────────────────────────

describe('PlayerService.updatePlayerStatus — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(service.updatePlayerStatus('p1', { status: 'RELEASED' }, 1, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

// ─── promotePlayer ───────────────────────────────────────────────────────────

describe('PlayerService.promotePlayer — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(service.promotePlayer('p1', 2, 1, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

// ─── updateWorkPermit ────────────────────────────────────────────────────────

describe('PlayerService.updateWorkPermit — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(
      service.updateWorkPermit('p1', { workPermitStatus: 'PENDING' }, 99),
    ).rejects.toThrow(new AppError(404, 'PLAYER_NOT_FOUND'));
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

// ─── deletePlayer ────────────────────────────────────────────────────────────

describe('PlayerService.deletePlayer — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo);
    await expect(service.deletePlayer('p1', 1, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

// ─── updateMarketValue ───────────────────────────────────────────────────────

describe('PlayerService.updateMarketValue — clubId 스코핑', () => {
  it('다른 clubId면 PLAYER_NOT_FOUND 404', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new PlayerService(repo, makeMvRepo());
    await expect(service.updateMarketValue('p1', { value: 1000000 }, 1, 99)).rejects.toThrow(
      new AppError(404, 'PLAYER_NOT_FOUND'),
    );
    expect(repo.findById).toHaveBeenCalledWith('p1', 99);
  });
});

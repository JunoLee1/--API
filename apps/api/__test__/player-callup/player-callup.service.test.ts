import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PlayerCallupRepository } from '../../src/player-callup/player-callup.repo';
import { PlayerCallupService } from '../../src/player-callup/player-callup.service';
import { NotificationRepository } from '../../src/notification/notification.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let headCoachUserId: number;
let gmUserId: number;
let teamId: number;
let testPlayerId: string;
let callupId: number;

beforeAll(async () => {
  const headCoach = await prisma.user.findFirst({
    where: { role: 'COACHING_STAFF', coachingRole: 'HEAD_COACH' },
    select: { id: true },
  });
  if (!headCoach) throw new Error('HEAD_COACH user 없음');
  headCoachUserId = headCoach.id;

  const gm = await prisma.user.findFirst({
    where: { role: 'GM' },
    select: { id: true },
  });
  if (!gm) throw new Error('GM user 없음');
  gmUserId = gm.id;

  const team = await prisma.team.findFirst({ select: { id: true } });
  if (!team) throw new Error('팀 없음 — seed 필요');
  teamId = team.id;

  const player = await prisma.player.findFirst({ select: { id: true } });
  if (!player) throw new Error('선수 없음 — seed 필요');
  testPlayerId = player.id;
});

afterAll(async () => {
  if (callupId) {
    await prisma.playerCallup.deleteMany({ where: { id: callupId } });
  }
  await prisma.$disconnect();
});

describe('PlayerCallupRepository', () => {
  const repo = () => new PlayerCallupRepository(prisma);

  it('콜업 생성', async () => {
    const r = await repo().create({
      playerId: testPlayerId,
      fromTeamId: teamId,
      toTeamId: teamId,
      requestedById: headCoachUserId,
      reason: '테스트 콜업',
      startDate: '2026-08-01',
    });
    expect(r.status).toBe('REQUESTED');
    expect(r.youthCoachConfirmed).toBe(false);
    expect(r.medicalConfirmed).toBe(false);
    callupId = r.id;
  });

  it('유소년감독 확인', async () => {
    const r = await repo().confirmYouth(callupId);
    expect(r.youthCoachConfirmed).toBe(true);
    expect(r.status).toBe('REQUESTED'); // medicalConfirmed 아직 false
  });

  it('의무팀 확인', async () => {
    const r = await repo().confirmMedical(callupId);
    expect(r.medicalConfirmed).toBe(true);
    expect(r.status).toBe('REQUESTED'); // youthCoachConfirmed 기반 자동 전환 없음 (Service 레이어 책임)
  });

  it('submitDocs → DOCS_SUBMITTED 전환', async () => {
    const r = await repo().submitDocs(callupId);
    expect(r.status).toBe('DOCS_SUBMITTED');
  });

  it('승인 처리 (DOCS_SUBMITTED → APPROVED)', async () => {
    const r = await repo().approve(callupId, gmUserId);
    expect(r.status).toBe('APPROVED');
  });

  it('목록 조회', async () => {
    const list = await repo().findAll({ status: 'APPROVED' });
    expect(list.some((c) => c.id === callupId)).toBe(true);
  });

  it('TRAINING 콜업 생성 시 callupType=TRAINING 반환', async () => {
    const r = await repo().create({
      playerId: testPlayerId,
      fromTeamId: teamId,
      toTeamId: teamId,
      requestedById: headCoachUserId,
      reason: '훈련 참가',
      startDate: '2026-08-01',
      callupType: 'TRAINING',
    });
    expect(r.callupType).toBe('TRAINING');
    await prisma.playerCallup.delete({ where: { id: r.id } });
  });
});

describe('PlayerCallupService — contract guard', () => {
  const notifRepo = new NotificationRepository(prisma);
  const service = () => new PlayerCallupService(new PlayerCallupRepository(prisma), notifRepo);

  it('OFFICIAL 콜업 — 활성 계약 없으면 approve 거부 (NO_ACTIVE_CONTRACT)', async () => {
    const player = await prisma.player.findFirst({
      where: { contracts: { none: { status: 'ACTIVE' } } },
      select: { id: true },
    });
    if (!player) {
      console.warn('SKIP: 계약 없는 선수 없음');
      return;
    }

    const callup = await prisma.playerCallup.create({
      data: {
        playerId: player.id,
        fromTeamId: teamId,
        toTeamId: teamId,
        requestedById: headCoachUserId,
        reason: '계약 없음 테스트',
        startDate: new Date('2026-08-01'),
        callupType: 'OFFICIAL',
        status: 'DOCS_SUBMITTED',
      },
    });

    await expect(service().approve(callup.id, gmUserId, true)).rejects.toMatchObject({ message: 'NO_ACTIVE_CONTRACT' });
    await prisma.playerCallup.delete({ where: { id: callup.id } });
  });

  it('TRAINING 콜업 — REQUESTED 상태에서 approve 가능, teamId 변경 없음', async () => {
    const before = await prisma.player.findUnique({
      where: { id: testPlayerId },
      select: { teamId: true },
    });

    const callup = await prisma.playerCallup.create({
      data: {
        playerId: testPlayerId,
        fromTeamId: teamId,
        toTeamId: teamId,
        requestedById: headCoachUserId,
        reason: '훈련 참가',
        startDate: new Date('2026-08-01'),
        callupType: 'TRAINING',
        status: 'REQUESTED',
      },
    });

    const approved = await service().approve(callup.id, gmUserId, true);
    expect(approved.status).toBe('APPROVED');

    const after = await prisma.player.findUnique({
      where: { id: testPlayerId },
      select: { teamId: true },
    });
    expect(after?.teamId).toBe(before?.teamId);

    await prisma.playerCallup.delete({ where: { id: callup.id } });
  });

  it('TRAINING 콜업 — complete() 시 teamId 변경 없음', async () => {
    const before = await prisma.player.findUnique({
      where: { id: testPlayerId },
      select: { teamId: true },
    });

    const callup = await prisma.playerCallup.create({
      data: {
        playerId: testPlayerId,
        fromTeamId: teamId,
        toTeamId: teamId,
        requestedById: headCoachUserId,
        reason: '훈련 참가 완료',
        startDate: new Date('2026-08-01'),
        callupType: 'TRAINING',
        status: 'APPROVED',
      },
    });

    const completed = await service().complete(callup.id, gmUserId);
    expect(completed.status).toBe('COMPLETED');

    const after = await prisma.player.findUnique({
      where: { id: testPlayerId },
      select: { teamId: true },
    });
    expect(after?.teamId).toBe(before?.teamId);

    await prisma.playerCallup.delete({ where: { id: callup.id } });
  });
});

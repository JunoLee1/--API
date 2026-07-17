import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let testPlayerId: string;
let testSessionId: number;
let testCoachUserId: number;
let testSeasonId: number;

beforeAll(async () => {
  const player = await prisma.player.findFirst();
  const session = await prisma.trainingSession.findFirst();
  const coach = await prisma.user.findFirst({ where: { coachingRole: 'HEAD_COACH' } });
  const season = await prisma.season.findFirst();

  if (!player || !session || !coach || !season) {
    throw new Error('테스트에 필요한 기존 데이터가 없습니다. seed를 먼저 실행하세요.');
  }

  testPlayerId = player.id;
  testSessionId = session.id;
  testCoachUserId = coach.id;
  testSeasonId = season.id;
});

afterAll(async () => {
  await prisma.playerDevelopmentPlan.deleteMany({ where: { coachId: testCoachUserId } });
  await prisma.trainingLoad.deleteMany({ where: { playerId: testPlayerId, sessionId: testSessionId } });
  await prisma.coachAvailability.deleteMany({ where: { userId: testCoachUserId } });
  await prisma.$disconnect();
});

describe('TrainingResult.scoredById', () => {
  it('scoredById 필드가 nullable로 존재한다', async () => {
    const result = await prisma.trainingResult.findFirst();
    expect('scoredById' in (result ?? {})).toBe(true);
  });
});

describe('CoachAvailability', () => {
  it('날짜 범위로 가용성 블록을 생성하고 삭제할 수 있다', async () => {
    const avail = await prisma.coachAvailability.create({
      data: {
        userId: testCoachUserId,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-14'),
        reason: '전지훈련',
        createdById: testCoachUserId,
      },
    });
    expect(avail.id).toBeDefined();
    expect(avail.reason).toBe('전지훈련');
    await prisma.coachAvailability.delete({ where: { id: avail.id } });
  });
});

describe('TrainingLoad', () => {
  it('선수 × 세션당 1개 제약으로 TrainingLoad를 생성할 수 있다', async () => {
    const load = await prisma.trainingLoad.create({
      data: {
        playerId: testPlayerId,
        sessionId: testSessionId,
        rpe: 7,
        load: 450,
      },
    });
    expect(load.rpe).toBe(7);
    expect(load.load).toBe(450);
  });

  it('동일 선수 × 세션 중복 생성 시 오류가 발생한다', async () => {
    await expect(
      prisma.trainingLoad.create({
        data: {
          playerId: testPlayerId,
          sessionId: testSessionId,
          rpe: 5,
          load: 300,
        },
      })
    ).rejects.toThrow();
  });
});

describe('PlayerDevelopmentPlan', () => {
  it('DRAFT 상태로 PDP를 생성할 수 있다', async () => {
    const pdp = await prisma.playerDevelopmentPlan.create({
      data: {
        playerId: testPlayerId,
        coachId: testCoachUserId,
        seasonId: testSeasonId,
        goals: '전진패스 성공률 70% 이상 달성',
        status: 'DRAFT',
      },
    });
    expect(pdp.status).toBe('DRAFT');
  });

  it('같은 선수 × 시즌 중복 PDP 생성 시 오류가 발생한다', async () => {
    await expect(
      prisma.playerDevelopmentPlan.create({
        data: {
          playerId: testPlayerId,
          coachId: testCoachUserId,
          seasonId: testSeasonId,
          goals: '중복 PDP',
          status: 'DRAFT',
        },
      })
    ).rejects.toThrow();
  });

  it('DRAFT → ACTIVE로 상태를 전환할 수 있다', async () => {
    const pdp = await prisma.playerDevelopmentPlan.findFirst({
      where: { playerId: testPlayerId, seasonId: testSeasonId },
    });
    const updated = await prisma.playerDevelopmentPlan.update({
      where: { id: pdp!.id },
      data: { status: 'ACTIVE' },
    });
    expect(updated.status).toBe('ACTIVE');
  });
});

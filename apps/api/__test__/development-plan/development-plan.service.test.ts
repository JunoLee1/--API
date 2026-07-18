import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DevelopmentPlanRepository } from '../../src/development-plan/development-plan.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
const repo = new DevelopmentPlanRepository(prisma);

let testPlayerId: string;
let testCoachId: number;
let testSeasonId: number;
let createdPlanId: number;

beforeAll(async () => {
  const player = await prisma.player.findFirst({ select: { id: true } });
  if (!player) throw new Error('테스트 player 없음');
  testPlayerId = player.id;

  const coach = await prisma.user.findFirst({
    where: { role: 'COACHING_STAFF' },
    select: { id: true },
  });
  if (!coach) throw new Error('테스트 COACHING_STAFF user 없음');
  testCoachId = coach.id;

  const season = await prisma.season.findFirst({ select: { id: true } });
  if (!season) throw new Error('테스트 season 없음');
  testSeasonId = season.id;
});

afterAll(async () => {
  if (createdPlanId) {
    await prisma.playerDevelopmentPlan.deleteMany({ where: { id: createdPlanId } });
  }
  await prisma.$disconnect();
});

describe('DevelopmentPlanRepository', () => {
  it('create - DRAFT 상태로 생성', async () => {
    const plan = await repo.create({
      playerId: testPlayerId,
      coachId: testCoachId,
      seasonId: testSeasonId,
      goals: '패스 정확도 향상',
    });
    expect(plan.status).toBe('DRAFT');
    expect(plan.goals).toBe('패스 정확도 향상');
    createdPlanId = plan.id;
  });

  it('findById - 생성된 플랜 조회', async () => {
    const found = await repo.findById(createdPlanId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(createdPlanId);
  });

  it('updateStatus - ACTIVE 전환', async () => {
    const updated = await repo.updateStatus(createdPlanId, 'ACTIVE');
    expect(updated.status).toBe('ACTIVE');
  });
});

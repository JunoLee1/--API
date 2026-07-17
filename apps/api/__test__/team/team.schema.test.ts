import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Team 모델', () => {
  it('FIRST_TEAM 레코드가 존재한다', async () => {
    const team = await prisma.team.findFirst({ where: { type: 'FIRST_TEAM' } });
    expect(team).not.toBeNull();
    expect(team?.trackStats).toBe(true);
    expect(team?.requiresContract).toBe(true);
  });

  it('YOUTH 팀을 생성하고 삭제할 수 있다', async () => {
    const youth = await prisma.team.create({
      data: { name: 'U18', type: 'YOUTH', ageGroup: 'U18', trackStats: false, requiresContract: false },
    });
    expect(youth.id).toBeDefined();
    await prisma.team.delete({ where: { id: youth.id } });
  });
});

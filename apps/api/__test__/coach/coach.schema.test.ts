import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

afterAll(async () => {
  await prisma.headCoachEvaluation.deleteMany({});
  await prisma.coach.deleteMany({ where: { name: 'Test Coach' } });
  await prisma.$disconnect();
});

describe('Coach 모델', () => {
  it('CANDIDATE 상태로 Coach를 생성할 수 있다', async () => {
    const coach = await prisma.coach.create({
      data: {
        name: 'Test Coach',
        coachingRole: 'HEAD_COACH',
        status: 'CANDIDATE',
      },
    });
    expect(coach.status).toBe('CANDIDATE');
    expect(coach.isDeleted).toBe(false);
  });

  it('HeadCoachEvaluation을 Coach에 연결할 수 있다', async () => {
    const coach = await prisma.coach.findFirst({ where: { name: 'Test Coach' } });
    const eval_ = await prisma.headCoachEvaluation.create({
      data: {
        coachId: coach!.id,
        possession: 55.5,
        philosophyFitScore: 82.0,
      },
    });
    expect(eval_.possession).toBe(55.5);
  });
});

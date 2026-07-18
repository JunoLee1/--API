import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { CoachRepository } from '../../src/coach/coach.repo';
import { CoachingRole } from '../../src/generated/enums';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
const repo = new CoachRepository(prisma);

const ALL_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH',
  'ATTACKING_COACH', 'GOALKEEPER_COACH', 'PHYSICAL_COACH', 'SET_PIECE_COACH',
];

let roundId: number;
let coach1Id: number;
let coach2Id: number;
let testRole: CoachingRole;

beforeAll(async () => {
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('테스트 user가 없습니다.');

  // 현재 CONTRACTED 상태가 아닌 역할 선택 (실제 DB 데이터와 충돌 방지)
  const contracted = await prisma.coach.findMany({
    where: { status: 'CONTRACTED', isDeleted: false },
    select: { coachingRole: true },
  });
  const filledRoles = new Set(contracted.map((c) => c.coachingRole));
  const available = ALL_ROLES.find((r) => !filledRoles.has(r));
  if (!available) throw new Error('모든 역할이 이미 채용됨 — 테스트 불가');
  testRole = available;

  const round = await prisma.coachHiringRound.create({
    data: { targetRole: testRole, fitScoreThreshold: 70, createdById: user.id },
  });
  roundId = round.id;

  const [c1, c2] = await Promise.all([
    prisma.coach.create({ data: { name: 'Test Coach DUP1', coachingRole: testRole, status: 'APPROVAL_PENDING', hiringRoundId: roundId } }),
    prisma.coach.create({ data: { name: 'Test Coach DUP2', coachingRole: testRole, status: 'APPROVAL_PENDING', hiringRoundId: roundId } }),
  ]);
  coach1Id = c1.id;
  coach2Id = c2.id;
});

afterAll(async () => {
  await prisma.coach.deleteMany({ where: { id: { in: [coach1Id, coach2Id].filter(Boolean) } } });
  await prisma.coachHiringRound.delete({ where: { id: roundId } }).catch(() => null);
  await prisma.$disconnect();
});

describe('CoachRepository.updateStatus — 중복 채용 차단', () => {
  it('첫 번째 CONTRACTED 전환은 성공한다', async () => {
    const { coach } = await repo.updateStatus(coach1Id, { status: 'CONTRACTED' });
    expect(coach.status).toBe('CONTRACTED');
  });

  it('동일 역할의 두 번째 CONTRACTED 전환은 COACHING_ROLE_ALREADY_FILLED를 던진다', async () => {
    await expect(
      repo.updateStatus(coach2Id, { status: 'CONTRACTED' }),
    ).rejects.toMatchObject({ code: 'COACHING_ROLE_ALREADY_FILLED' });
  });
});

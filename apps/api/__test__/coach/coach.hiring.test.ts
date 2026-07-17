import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let roundId: number;
let coachId: number;

afterAll(async () => {
  await prisma.coachTier2Evaluation.deleteMany({});
  await prisma.headCoachEvaluation.deleteMany({});
  await prisma.coachTutorAssignment.deleteMany({});
  await prisma.coach.deleteMany({ where: { name: { startsWith: 'Test Coach' } } });
  if (roundId) await prisma.coachHiringRound.delete({ where: { id: roundId } }).catch(() => null);
  await prisma.$disconnect();
});

describe('CoachHiringRound 모델', () => {
  it('OPEN 상태로 채용 라운드를 생성할 수 있다', async () => {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error('테스트 user가 없습니다. DB를 확인하세요.');

    const round = await prisma.coachHiringRound.create({
      data: {
        targetRole: 'HEAD_COACH',
        fitScoreThreshold: 75,
        createdById: user.id,
      },
    });
    roundId = round.id;
    expect(round.status).toBe('OPEN');
    expect(round.targetRole).toBe('HEAD_COACH');
    expect(round.fitScoreThreshold).toBe(75);
  });

  it('라운드 상태를 CLOSED로 변경할 수 있다', async () => {
    const round = await prisma.coachHiringRound.update({
      where: { id: roundId },
      data: { status: 'CLOSED', result: '채용 완료' },
    });
    expect(round.status).toBe('CLOSED');
    expect(round.result).toBe('채용 완료');
  });
});

describe('Coach 모델 + 상태머신', () => {
  it('CANDIDATE 상태로 코치 후보를 등록할 수 있다', async () => {
    const coach = await prisma.coach.create({
      data: {
        name: 'Test Coach HEAD',
        coachingRole: 'HEAD_COACH',
        status: 'CANDIDATE',
        hiringRoundId: roundId,
      },
    });
    coachId = coach.id;
    expect(coach.status).toBe('CANDIDATE');
    expect(coach.isDeleted).toBe(false);
  });

  it('CANDIDATE → SHORTLISTED 전환이 가능하다', async () => {
    const coach = await prisma.coach.update({
      where: { id: coachId },
      data: { status: 'SHORTLISTED', shortlistSource: 'MANUAL' },
    });
    expect(coach.status).toBe('SHORTLISTED');
    expect(coach.shortlistSource).toBe('MANUAL');
  });

  it('SHORTLISTED → APPROVAL_PENDING 전환이 가능하다', async () => {
    const coach = await prisma.coach.update({
      where: { id: coachId },
      data: { status: 'APPROVAL_PENDING' },
    });
    expect(coach.status).toBe('APPROVAL_PENDING');
  });

  it('APPROVAL_PENDING → CONTRACTED 전환이 가능하다', async () => {
    const coach = await prisma.coach.update({
      where: { id: coachId },
      data: { status: 'CONTRACTED' },
    });
    expect(coach.status).toBe('CONTRACTED');
  });
});

describe('HeadCoachEvaluation', () => {
  it('Coach에 HeadCoachEvaluation을 upsert할 수 있다', async () => {
    const eval_ = await prisma.headCoachEvaluation.upsert({
      where: { coachId },
      create: { coachId, possession: 56.2, philosophyFitScore: 88.0 },
      update: { possession: 56.2, philosophyFitScore: 88.0 },
    });
    expect(eval_.possession).toBe(56.2);
    expect(eval_.philosophyFitScore).toBe(88.0);
  });
});

describe('CoachTier2Evaluation', () => {
  it('Tier2 Coach에 평가를 upsert할 수 있다', async () => {
    const tier2Coach = await prisma.coach.create({
      data: { name: 'Test Coach ASSISTANT', coachingRole: 'ASSISTANT_COACH', status: 'CANDIDATE' },
    });
    const eval_ = await prisma.coachTier2Evaluation.upsert({
      where: { coachId: tier2Coach.id },
      create: { coachId: tier2Coach.id, fitScore: 75, notes: '팀 적응 양호' },
      update: { fitScore: 75, notes: '팀 적응 양호' },
    });
    expect(eval_.fitScore).toBe(75);
    await prisma.coachTier2Evaluation.delete({ where: { coachId: tier2Coach.id } });
    await prisma.coach.delete({ where: { id: tier2Coach.id } });
  });
});

describe('CoachTutorAssignment', () => {
  it('외부 튜터를 배정할 수 있다', async () => {
    const tutor = await prisma.coachTutorAssignment.create({
      data: {
        coachId,
        type: 'EXTERNAL',
        externalName: '김통역사',
        externalContact: '010-0000-0000',
        sessionCount: 0,
      },
    });
    expect(tutor.type).toBe('EXTERNAL');
    expect(tutor.externalName).toBe('김통역사');
  });
});

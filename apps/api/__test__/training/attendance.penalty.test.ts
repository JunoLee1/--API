import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { calcEffectiveAbsences, shouldTriggerPenalty } from '../../src/training/training.service';
import { TrainingRepository } from '../../src/training/training.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ── 순수 함수 단위 테스트 ────────────────────────────────────────────────────

describe('calcEffectiveAbsences', () => {
  it('무단 결석만 카운트', () => {
    expect(calcEffectiveAbsences(3, 0)).toBe(3);
  });
  it('무단 지각 3회 = 무단 결석 1회', () => {
    expect(calcEffectiveAbsences(0, 3)).toBe(1);
  });
  it('혼합: 결석 2 + 지각 3 = effective 3', () => {
    expect(calcEffectiveAbsences(2, 3)).toBe(3);
  });
  it('지각 나머지는 버림: floor(8/3)=2', () => {
    expect(calcEffectiveAbsences(0, 8)).toBe(2);
  });
});

describe('shouldTriggerPenalty', () => {
  it('3회 도달 시 트리거', () => {
    expect(shouldTriggerPenalty(3)).toBe(true);
  });
  it('6회 도달 시 재트리거', () => {
    expect(shouldTriggerPenalty(6)).toBe(true);
  });
  it('0회는 트리거 안함', () => {
    expect(shouldTriggerPenalty(0)).toBe(false);
  });
  it('1, 2, 4, 5회는 트리거 안함', () => {
    expect(shouldTriggerPenalty(1)).toBe(false);
    expect(shouldTriggerPenalty(2)).toBe(false);
    expect(shouldTriggerPenalty(4)).toBe(false);
    expect(shouldTriggerPenalty(5)).toBe(false);
  });
});

// ── countUnexcusedAttendance 통합 테스트 ──────────────────────────────────

let s1Id: number;
let s2Id: number;
let s3Id: number;
let testPlayerId: string;

beforeAll(async () => {
  const player = await prisma.player.findFirst({ select: { id: true } });
  if (!player) throw new Error('테스트 player가 없습니다.');
  testPlayerId = player.id;

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('테스트 user가 없습니다.');
  const season = await prisma.season.findFirst({ select: { id: true } });
  if (!season) throw new Error('테스트 season이 없습니다.');

  const base = { goal: '페널티테스트', sessionType: 'PHYSICAL' as const, seasonId: season.id, createdById: user.id };
  const [a, b, c] = await Promise.all([
    prisma.trainingSession.create({ data: { ...base, date: new Date('2026-01-01') } }),
    prisma.trainingSession.create({ data: { ...base, date: new Date('2026-01-02') } }),
    prisma.trainingSession.create({ data: { ...base, date: new Date('2026-01-03') } }),
  ]);
  s1Id = a.id; s2Id = b.id; s3Id = c.id;
});

afterAll(async () => {
  await prisma.trainingResult.deleteMany({ where: { sessionId: { in: [s1Id, s2Id, s3Id] } } });
  await prisma.trainingSession.deleteMany({ where: { id: { in: [s1Id, s2Id, s3Id] } } });
  await prisma.$disconnect();
});

describe('TrainingRepository.countUnexcusedAttendance', () => {
  it('기록 없으면 0 반환', async () => {
    const repo = new TrainingRepository(prisma);
    const result = await repo.countUnexcusedAttendance(testPlayerId);
    expect(result.absences).toBe(0);
    expect(result.lateCount).toBe(0);
  });

  it('무단 결석 1 + 무단 지각 1 카운트', async () => {
    await prisma.trainingResult.createMany({
      data: [
        { sessionId: s1Id, playerId: testPlayerId, attendance: 'ABSENT_UNAUTHORIZED' },
        { sessionId: s2Id, playerId: testPlayerId, attendance: 'LATE_UNAUTHORIZED' },
        { sessionId: s3Id, playerId: testPlayerId, attendance: 'PRESENT' },
      ],
    });
    const repo = new TrainingRepository(prisma);
    const result = await repo.countUnexcusedAttendance(testPlayerId);
    expect(result.absences).toBe(1);
    expect(result.lateCount).toBe(1);
  });
});

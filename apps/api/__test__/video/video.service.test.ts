import 'dotenv/config';
import { PrismaClient } from '../../src/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { VideoRepository } from '../../src/video/video.repo';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

let testUploaderId: number;
let testPlayerId: string;
let videoId: number;

beforeAll(async () => {
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('테스트 user 없음');
  testUploaderId = user.id;

  const player = await prisma.player.findFirst({ select: { id: true } });
  if (!player) throw new Error('테스트 player 없음');
  testPlayerId = player.id;
});

afterAll(async () => {
  if (videoId) {
    await prisma.videoAssignment.deleteMany({ where: { videoId } });
    await prisma.trainingVideo.delete({ where: { id: videoId } });
  }
  await prisma.$disconnect();
});

describe('VideoRepository', () => {
  it('영상 생성', async () => {
    const repo = new VideoRepository(prisma);
    const video = await repo.createVideo({
      title: '수비 포지셔닝 영상',
      url: 'https://example.com/video1',
      tags: ['수비', '포지셔닝'],
      sessionType: 'TACTICAL_DEFENSIVE',
      uploadedById: testUploaderId,
    });
    videoId = video.id;
    expect(video.title).toBe('수비 포지셔닝 영상');
    expect(video.tags).toContain('수비');
  });

  it('영상 목록 조회', async () => {
    const repo = new VideoRepository(prisma);
    const list = await repo.findVideos({});
    expect(list.length).toBeGreaterThan(0);
  });

  it('과제 할당', async () => {
    const repo = new VideoRepository(prisma);
    const assignment = await repo.createAssignment({
      videoId,
      playerId: testPlayerId,
      assignedById: testUploaderId,
      dueDate: new Date('2027-01-01'),
      note: '복습 필수',
    });
    expect(assignment.videoId).toBe(videoId);
    expect(assignment.progressRate).toBe(0);
  });

  it('진행률 업데이트', async () => {
    const repo = new VideoRepository(prisma);
    const updated = await repo.updateProgress(videoId, testPlayerId, 50);
    expect(updated.progressRate).toBe(50);
  });
});

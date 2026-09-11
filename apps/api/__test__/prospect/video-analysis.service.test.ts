import { VideoAnalysisService } from '../../src/prospect/video-analysis.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => ({
  videoAnalysisJob: {
    create: jest.fn().mockResolvedValue({ id: 1, prospectId: 10, videoUrl: 'https://cdn.example.com/clip.mp4', status: 'PENDING' }),
    update: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn(),
    ...overrides['videoAnalysisJob'],
  },
})

describe('VideoAnalysisService', () => {
  describe('createJob', () => {
    it('유효한 URL이면 job 생성 후 반환', async () => {
      const prisma = makePrisma() as any
      const svc = new VideoAnalysisService(prisma)
      const job = await svc.createJob(10, 'https://cdn.example.com/clip.mp4')
      expect(prisma.videoAnalysisJob.create).toHaveBeenCalledWith({
        data: { prospectId: 10, videoUrl: 'https://cdn.example.com/clip.mp4' },
      })
      expect(job.id).toBe(1)
    })

    it('유효하지 않은 URL이면 INVALID_VIDEO_URL 에러', async () => {
      const prisma = makePrisma() as any
      const svc = new VideoAnalysisService(prisma)
      await expect(svc.createJob(10, 'not-a-url')).rejects.toMatchObject({ message: 'INVALID_VIDEO_URL' })
      expect(prisma.videoAnalysisJob.create).not.toHaveBeenCalled()
    })

    it('비디오 확장자가 없는 일반 URL이면 INVALID_VIDEO_URL 에러', async () => {
      const prisma = makePrisma() as any
      const svc = new VideoAnalysisService(prisma)
      await expect(svc.createJob(10, 'https://example.com/some-page')).rejects.toMatchObject({ message: 'INVALID_VIDEO_URL' })
    })

    it('YouTube URL이면 통과', async () => {
      const prisma = makePrisma() as any
      const svc = new VideoAnalysisService(prisma)
      await expect(svc.createJob(10, 'https://www.youtube.com/watch?v=abc123')).resolves.toBeDefined()
    })
  })

  describe('getJob', () => {
    it('job 있으면 반환', async () => {
      const jobRecord = { id: 7, prospectId: 10, status: 'DONE' }
      const prisma = makePrisma({
        videoAnalysisJob: { findFirst: jest.fn().mockResolvedValue(jobRecord) },
      }) as any
      const svc = new VideoAnalysisService(prisma)
      const result = await svc.getJob(10, 7)
      expect(result).toEqual(jobRecord)
      expect(prisma.videoAnalysisJob.findFirst).toHaveBeenCalledWith({
        where: { id: 7, prospectId: 10 },
      })
    })

    it('job 없으면 null 반환', async () => {
      const prisma = makePrisma({
        videoAnalysisJob: { findFirst: jest.fn().mockResolvedValue(null) },
      }) as any
      const svc = new VideoAnalysisService(prisma)
      const result = await svc.getJob(10, 999)
      expect(result).toBeNull()
    })
  })

  describe('handleWebhook', () => {
    it('DONE 상태로 업데이트', async () => {
      const prisma = makePrisma() as any
      const svc = new VideoAnalysisService(prisma)
      const data = { detectionConfidence: 0.9, trackingScore: 0.85, detectedJerseyNumbers: [{ number: 11, confidence: 0.95 }] }
      await svc.handleWebhook(1, 'DONE', data)
      expect(prisma.videoAnalysisJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'DONE', pipelineData: data }),
        }),
      )
    })

    it('FAILED 상태 + errorMessage 업데이트', async () => {
      const prisma = makePrisma() as any
      const svc = new VideoAnalysisService(prisma)
      await svc.handleWebhook(2, 'FAILED', undefined, '타임아웃')
      expect(prisma.videoAnalysisJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: expect.objectContaining({ status: 'FAILED', errorMessage: '타임아웃' }),
        }),
      )
    })
  })
})

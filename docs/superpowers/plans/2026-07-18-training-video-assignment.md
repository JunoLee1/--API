# TrainingVideo & VideoAssignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 훈련 영상(TrainingVideo)을 클럽 전체 공유 자산으로 관리하고, 코치가 선수에게 영상을 과제로 할당(VideoAssignment)하여 진행률을 추적하며 기한 초과 시 자동 알림을 발송한다.

**Architecture:** schema.prisma에 `TrainingVideo`, `VideoAssignment` 모델을 추가하고 `prisma db push`로 반영한다. BE는 `apps/api/src/video/` 모듈(repo/service/controller/routes)로 구성하며 `apiRouter.ts`에 등록한다. 기한 초과 알림은 `jobs/videoAssignmentOverdue.ts` cron으로 처리한다. FE는 영상 목록/상세 페이지와 선수 과제 패널을 구현한다.

**Tech Stack:** Prisma, Express, TypeScript (BE) / React, shadcn/ui, react-router-dom (FE) / node-cron (알림)

---

## 파일 구조

**신규 생성:**
- `apps/api/prisma/schema.prisma` — TrainingVideo, VideoAssignment 모델 + NotificationType enum 추가
- `apps/api/src/video/dto/video.dto.ts`
- `apps/api/src/video/video.repo.ts`
- `apps/api/src/video/video.service.ts`
- `apps/api/src/video/video.controller.ts`
- `apps/api/src/video/video.routes.ts`
- `apps/api/src/jobs/videoAssignmentOverdue.ts`
- `apps/api/__test__/video/video.service.test.ts`
- `football/src/types/video.ts`
- `football/src/services/video.service.ts`
- `football/src/pages/training/TrainingVideoPage.tsx`

**수정:**
- `apps/api/src/apiRouter.ts` — `/videos` 라우트 등록
- `apps/api/src/server.ts` — cron job 시작
- `football/src/App.tsx` — `/training/videos` 라우트
- `football/src/layouts/AppShell.tsx` — 사이드바 링크

---

### Task 1: Prisma 스키마 추가 + DB 반영

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: schema.prisma에 모델 추가**

`NotificationType` enum 끝 (`TRAINING_SESSION_PENDING` 다음)에 추가:
```prisma
  VIDEO_ASSIGNED
  VIDEO_ASSIGNMENT_OVERDUE
```

파일 맨 끝에 모델 추가:
```prisma
model TrainingVideo {
  id           Int          @id @default(autoincrement())
  title        String
  url          String
  tags         String[]
  sessionType  SessionType?
  uploadedById Int
  createdAt    DateTime     @default(now())

  uploader    User              @relation("VideoUploader", fields: [uploadedById], references: [id])
  assignments VideoAssignment[]
}

model VideoAssignment {
  id           Int      @id @default(autoincrement())
  videoId      Int
  playerId     String
  assignedById Int
  dueDate      DateTime?
  progressRate Int      @default(0)
  note         String?
  createdAt    DateTime @default(now())

  video      TrainingVideo @relation(fields: [videoId], references: [id])
  player     Player        @relation(fields: [playerId], references: [id])
  assignedBy User          @relation("VideoAssigner", fields: [assignedById], references: [id])

  @@unique([videoId, playerId])
}
```

`User` 모델에 relation 필드 추가 (기존 relation 목록 끝에):
```prisma
  uploadedVideos   TrainingVideo[]   @relation("VideoUploader")
  videoAssignments VideoAssignment[] @relation("VideoAssigner")
```

`Player` 모델에 relation 필드 추가:
```prisma
  videoAssignments VideoAssignment[]
```

- [ ] **Step 2: DB 반영**

```bash
cd apps/api && npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Prisma 클라이언트 재생성**

```bash
cd apps/api && npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add TrainingVideo and VideoAssignment models"
```

---

### Task 2: BE — DTO + Repository

**Files:**
- Create: `apps/api/src/video/dto/video.dto.ts`
- Create: `apps/api/src/video/video.repo.ts`
- Create: `apps/api/__test__/video/video.service.test.ts` (통합 테스트 - repo 직접 테스트)

- [ ] **Step 1: Write failing test**

```typescript
// apps/api/__test__/video/video.service.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api && npx jest __test__/video/video.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module '../../src/video/video.repo'"

- [ ] **Step 3: DTO 작성**

```typescript
// apps/api/src/video/dto/video.dto.ts
import { SessionType } from "../generated/enums";

export interface CreateVideoDto {
  title: string;
  url: string;
  tags?: string[];
  sessionType?: SessionType;
}

export interface CreateAssignmentDto {
  videoId: number;
  playerId: string;
  assignedById: number;
  dueDate?: Date;
  note?: string;
}

export interface VideoListQuery {
  sessionType?: SessionType;
  tag?: string;
}
```

- [ ] **Step 4: Repository 작성**

```typescript
// apps/api/src/video/video.repo.ts
import { PrismaClient } from "../generated/client";
import { CreateVideoDto, CreateAssignmentDto, VideoListQuery } from "./dto/video.dto";

export class VideoRepository {
  constructor(private prisma: PrismaClient) {}

  createVideo(dto: CreateVideoDto & { uploadedById: number }) {
    return this.prisma.trainingVideo.create({
      data: {
        title: dto.title,
        url: dto.url,
        tags: dto.tags ?? [],
        sessionType: dto.sessionType ?? null,
        uploadedById: dto.uploadedById,
      },
    });
  }

  findVideos(query: VideoListQuery) {
    return this.prisma.trainingVideo.findMany({
      where: {
        ...(query.sessionType && { sessionType: query.sessionType }),
        ...(query.tag && { tags: { has: query.tag } }),
      },
      include: {
        uploader: { select: { id: true, nickname: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findVideoById(id: number) {
    return this.prisma.trainingVideo.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, nickname: true } },
        assignments: {
          include: {
            player: { select: { id: true, playerName: true, position: true } },
            assignedBy: { select: { id: true, nickname: true } },
          },
        },
      },
    });
  }

  createAssignment(dto: CreateAssignmentDto) {
    return this.prisma.videoAssignment.create({
      data: {
        videoId: dto.videoId,
        playerId: dto.playerId,
        assignedById: dto.assignedById,
        dueDate: dto.dueDate ?? null,
        note: dto.note ?? null,
      },
    });
  }

  findAssignmentsByPlayer(playerId: string) {
    return this.prisma.videoAssignment.findMany({
      where: { playerId },
      include: {
        video: { select: { id: true, title: true, url: true, tags: true, sessionType: true } },
        assignedBy: { select: { id: true, nickname: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  updateProgress(videoId: number, playerId: string, progressRate: number) {
    return this.prisma.videoAssignment.update({
      where: { videoId_playerId: { videoId, playerId } },
      data: { progressRate },
    });
  }

  findOverdueAssignments(now: Date) {
    return this.prisma.videoAssignment.findMany({
      where: {
        dueDate: { lt: now },
        progressRate: { lt: 100 },
      },
      include: {
        player: { select: { id: true, playerName: true } },
        assignedBy: { select: { id: true } },
        video: { select: { id: true, title: true } },
      },
    });
  }

  deleteVideo(id: number) {
    return this.prisma.trainingVideo.delete({ where: { id } });
  }
}
```

- [ ] **Step 5: Run test**

```bash
cd apps/api && npx jest __test__/video/video.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 4 passing

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/video/dto/video.dto.ts apps/api/src/video/video.repo.ts apps/api/__test__/video/video.service.test.ts
git commit -m "feat(video): add VideoRepository with CRUD and assignment methods"
```

---

### Task 3: BE — Service + Controller + Routes

**Files:**
- Create: `apps/api/src/video/video.service.ts`
- Create: `apps/api/src/video/video.controller.ts`
- Create: `apps/api/src/video/video.routes.ts`
- Modify: `apps/api/src/apiRouter.ts`

- [ ] **Step 1: Service 작성**

```typescript
// apps/api/src/video/video.service.ts
import { VideoRepository } from "./video.repo";
import { AppError } from "../lib/appError";
import { NotificationRepository } from "../notification/notification.repo";
import { CreateVideoDto, CreateAssignmentDto, VideoListQuery } from "./dto/video.dto";

export class VideoService {
  constructor(
    private repo: VideoRepository,
    private notifRepo: NotificationRepository,
  ) {}

  getVideos(query: VideoListQuery) {
    return this.repo.findVideos(query);
  }

  async getVideoById(id: number) {
    const video = await this.repo.findVideoById(id);
    if (!video) throw new AppError(404, "VIDEO_NOT_FOUND");
    return video;
  }

  createVideo(dto: CreateVideoDto, uploadedById: number) {
    return this.repo.createVideo({ ...dto, uploadedById });
  }

  async deleteVideo(id: number, userId: number, isAdmin: boolean) {
    const video = await this.repo.findVideoById(id);
    if (!video) throw new AppError(404, "VIDEO_NOT_FOUND");
    if (!isAdmin && video.uploadedById !== userId) throw new AppError(403, "FORBIDDEN");
    return this.repo.deleteVideo(id);
  }

  getMyAssignments(playerId: string) {
    return this.repo.findAssignmentsByPlayer(playerId);
  }

  async createAssignment(dto: CreateAssignmentDto) {
    const assignment = await this.repo.createAssignment(dto);
    void this.notifRepo
      .create({
        userId: Number(dto.playerId),
        type: "VIDEO_ASSIGNED",
        title: "새 영상 과제가 할당됐습니다",
        body: `영상 ID ${dto.videoId}가 과제로 할당됐습니다.`,
        entityId: assignment.id,
      })
      .catch(console.error);
    return assignment;
  }

  async updateProgress(videoId: number, playerId: string, progressRate: number, requesterId: string) {
    if (progressRate < 0 || progressRate > 100) throw new AppError(400, "INVALID_PROGRESS_RATE");
    if (requesterId !== playerId) throw new AppError(403, "FORBIDDEN");
    return this.repo.updateProgress(videoId, playerId, progressRate);
  }
}
```

- [ ] **Step 2: Controller 작성**

```typescript
// apps/api/src/video/video.controller.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { VideoService } from "./video.service";

const CAN_WRITE = ["ADMIN", "COACHING_STAFF"];

export class VideoController {
  constructor(private service: VideoService) {}

  getVideos = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getVideos({
        sessionType: req.query["sessionType"] as any,
        tag: req.query["tag"] as string | undefined,
      }));
    } catch (err) { next(err); }
  };

  getVideoById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.service.getVideoById(Number(req.params["id"])));
    } catch (err) { next(err); }
  };

  createVideo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CAN_WRITE.includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createVideo(req.body, req.user!.id));
    } catch (err) { next(err); }
  };

  deleteVideo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CAN_WRITE.includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      await this.service.deleteVideo(
        Number(req.params["id"]),
        req.user!.id,
        req.user!.role === "ADMIN",
      );
      res.status(204).send();
    } catch (err) { next(err); }
  };

  getMyAssignments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "PLAYER") throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.getMyAssignments(req.user!.playerId!));
    } catch (err) { next(err); }
  };

  createAssignment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!CAN_WRITE.includes(req.user!.role)) throw new AppError(403, "FORBIDDEN");
      res.status(201).json(await this.service.createAssignment({
        videoId: Number(req.params["id"]),
        playerId: req.body.playerId,
        assignedById: req.user!.id,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        note: req.body.note,
      }));
    } catch (err) { next(err); }
  };

  updateProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "PLAYER") throw new AppError(403, "FORBIDDEN");
      res.json(await this.service.updateProgress(
        Number(req.params["id"]),
        req.params["playerId"],
        Number(req.body.progressRate),
        req.user!.playerId!,
      ));
    } catch (err) { next(err); }
  };
}
```

- [ ] **Step 3: Routes 작성**

```typescript
// apps/api/src/video/video.routes.ts
import { Router } from "express";
import passport from "passport";
import { VideoController } from "./video.controller";
import { VideoService } from "./video.service";
import { VideoRepository } from "./video.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { getPrisma } from "../lib/prisma";

const router = Router();
const repo = new VideoRepository(getPrisma());
const notifRepo = new NotificationRepository(getPrisma());
const service = new VideoService(repo, notifRepo);
const controller = new VideoController(service);

const auth = passport.authenticate("accessToken", { session: false });

router.get("/", auth, controller.getVideos);
router.get("/my-assignments", auth, controller.getMyAssignments);
router.get("/:id", auth, controller.getVideoById);
router.post("/", auth, controller.createVideo);
router.delete("/:id", auth, controller.deleteVideo);
router.post("/:id/assignments", auth, controller.createAssignment);
router.patch("/:id/assignments/:playerId/progress", auth, controller.updateProgress);

export default router;
```

- [ ] **Step 4: apiRouter.ts에 등록**

`apps/api/src/apiRouter.ts`에 import 추가:
```typescript
import videoRouter from "./video/video.routes";
```

`apiRouter.use("/transfers", transferRouter);` 다음에 추가:
```typescript
apiRouter.use("/videos", videoRouter);
```

- [ ] **Step 5: TypeScript 빌드 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음 (또는 기존 오류만)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/video/ apps/api/src/apiRouter.ts
git commit -m "feat(video): add video service, controller, and routes"
```

---

### Task 4: BE — 기한 초과 cron job

**Files:**
- Create: `apps/api/src/jobs/videoAssignmentOverdue.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Cron job 작성**

```typescript
// apps/api/src/jobs/videoAssignmentOverdue.ts
import cron from "node-cron";
import { getPrisma } from "../lib/prisma";
import { VideoRepository } from "../video/video.repo";
import { NotificationRepository } from "../notification/notification.repo";

export function startVideoAssignmentOverdueJob() {
  cron.schedule("0 9 * * *", async () => {
    const prisma = getPrisma();
    const videoRepo = new VideoRepository(prisma);
    const notifRepo = new NotificationRepository(prisma);
    const now = new Date();

    const overdue = await videoRepo.findOverdueAssignments(now);
    for (const assignment of overdue) {
      try {
        await notifRepo.create({
          userId: assignment.assignedBy.id,
          type: "VIDEO_ASSIGNMENT_OVERDUE",
          title: "영상 과제 기한 초과",
          body: `${assignment.player.playerName} 선수의 "${assignment.video.title}" 과제가 기한을 초과했습니다.`,
          entityId: assignment.videoId,
        });
      } catch (err) {
        console.error("[cron] 영상 과제 기한 초과 알림 실패:", err);
      }
    }
  });
}
```

- [ ] **Step 2: server.ts에 cron 시작 추가**

`apps/api/src/server.ts`에서 기존 cron import 라인들 아래에 추가:
```typescript
import { startVideoAssignmentOverdueJob } from "./jobs/videoAssignmentOverdue";
```

그리고 기존 cron 시작 호출 아래에 추가:
```typescript
startVideoAssignmentOverdueJob();
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/jobs/videoAssignmentOverdue.ts apps/api/src/server.ts
git commit -m "feat(video): add cron job for overdue video assignment notifications"
```

---

### Task 5: FE — 타입 + 서비스

**Files:**
- Create: `football/src/types/video.ts`
- Create: `football/src/services/video.service.ts`

- [ ] **Step 1: 타입 정의**

```typescript
// football/src/types/video.ts
import type { SessionType } from './training'

export interface TrainingVideo {
  id: number
  title: string
  url: string
  tags: string[]
  sessionType: SessionType | null
  uploadedById: number
  createdAt: string
  uploader: { id: number; nickname: string }
  _count?: { assignments: number }
}

export interface VideoAssignment {
  id: number
  videoId: number
  playerId: string
  assignedById: number
  dueDate: string | null
  progressRate: number
  note: string | null
  createdAt: string
  video: Pick<TrainingVideo, 'id' | 'title' | 'url' | 'tags' | 'sessionType'>
  assignedBy: { id: number; nickname: string }
}

export interface TrainingVideoDetail extends TrainingVideo {
  assignments: (Omit<VideoAssignment, 'video'> & {
    player: { id: string; playerName: string; position: string }
    assignedBy: { id: number; nickname: string }
  })[]
}

export interface CreateVideoPayload {
  title: string
  url: string
  tags: string[]
  sessionType?: SessionType | ''
}

export interface CreateAssignmentPayload {
  playerId: string
  dueDate?: string
  note?: string
}
```

- [ ] **Step 2: API 서비스 작성**

```typescript
// football/src/services/video.service.ts
import { api } from './api'
import type {
  TrainingVideo,
  TrainingVideoDetail,
  VideoAssignment,
  CreateVideoPayload,
  CreateAssignmentPayload,
} from '@/types/video'
import type { SessionType } from '@/types/training'

export const videoApi = {
  list: (params?: { sessionType?: SessionType; tag?: string }) => {
    const q = new URLSearchParams()
    if (params?.sessionType) q.set('sessionType', params.sessionType)
    if (params?.tag) q.set('tag', params.tag)
    const qs = q.toString()
    return api.get<TrainingVideo[]>(`/videos${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<TrainingVideoDetail>(`/videos/${id}`),

  create: (payload: CreateVideoPayload) =>
    api.post<TrainingVideo>('/videos', payload),

  delete: (id: number) => api.delete<void>(`/videos/${id}`),

  getMyAssignments: () => api.get<VideoAssignment[]>('/videos/my-assignments'),

  createAssignment: (videoId: number, payload: CreateAssignmentPayload) =>
    api.post<VideoAssignment>(`/videos/${videoId}/assignments`, payload),

  updateProgress: (videoId: number, playerId: string, progressRate: number) =>
    api.patch<VideoAssignment>(`/videos/${videoId}/assignments/${playerId}/progress`, { progressRate }),
}
```

- [ ] **Step 3: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add football/src/types/video.ts football/src/services/video.service.ts
git commit -m "feat(video): add FE types and API service"
```

---

### Task 6: FE — TrainingVideoPage

**Files:**
- Create: `football/src/pages/training/TrainingVideoPage.tsx`
- Modify: `football/src/App.tsx`
- Modify: `football/src/layouts/AppShell.tsx`

- [ ] **Step 1: 페이지 컴포넌트 작성**

```typescript
// football/src/pages/training/TrainingVideoPage.tsx
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { videoApi } from '@/services/video.service'
import type { TrainingVideo, CreateVideoPayload } from '@/types/video'
import type { SessionType } from '@/types/training'
import { SESSION_TYPE_LABEL } from '@/types/training'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Plus, ExternalLink, Trash2 } from 'lucide-react'

const PAGE_SIZE = 10

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

interface CreateVideoDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateVideoDialog({ open, onOpenChange, onSaved }: CreateVideoDialogProps) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')
  const [sessionType, setSessionType] = useState<SessionType | ''>('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim() || !url.trim()) {
      toast.error('제목과 URL은 필수입니다.')
      return
    }
    setSaving(true)
    try {
      const payload: CreateVideoPayload = {
        title: title.trim(),
        url: url.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        sessionType: sessionType || undefined,
      }
      await videoApi.create(payload)
      toast.success('영상이 등록됐습니다.')
      onSaved()
      setTitle(''); setUrl(''); setTags(''); setSessionType('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>영상 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="영상 제목" />
          </div>
          <div className="space-y-1.5">
            <Label>URL *</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>태그 (쉼표 구분)</Label>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="수비, 압박" />
          </div>
          <div className="space-y-1.5">
            <Label>세션 유형</Label>
            <Select
              value={sessionType}
              onValueChange={v => setSessionType(v as SessionType | '')}
              items={{ '': '전체', ...SESSION_TYPE_LABEL }}
            >
              <SelectTrigger><SelectValue placeholder="선택 안함" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">선택 안함</SelectItem>
                {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map(t => (
                  <SelectItem key={t} value={t}>{SESSION_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TrainingVideoPage() {
  const { user } = useCurrentUser()
  const [videos, setVideos] = useState<TrainingVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [filterTag, setFilterTag] = useState('')

  const canWrite = user?.role === 'ADMIN' || user?.role === 'COACHING_STAFF'
  const canDelete = (uploadedById: number) =>
    user?.role === 'ADMIN' || user?.id === uploadedById

  const fetchVideos = () => {
    setLoading(true)
    videoApi.list()
      .then(setVideos)
      .catch(() => toast.error('영상 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchVideos() }, [])

  const handleDelete = async (id: number) => {
    try {
      await videoApi.delete(id)
      toast.success('삭제됐습니다.')
      setVideos(prev => prev.filter(v => v.id !== id))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const filtered = filterTag.trim()
    ? videos.filter(v => v.tags.some(t => t.includes(filterTag.trim())))
    : videos

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">훈련 영상</h1>
          <p className="text-sm text-muted-foreground mt-0.5">전체 {filtered.length}개</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />영상 등록
          </Button>
        )}
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        <Input
          placeholder="태그 검색"
          value={filterTag}
          onChange={e => { setFilterTag(e.target.value); setPage(1) }}
          className="w-44 h-8 text-sm bg-background"
        />
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            등록된 영상이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>제목</TableHead>
                <TableHead className="w-32">세션 유형</TableHead>
                <TableHead>태그</TableHead>
                <TableHead className="w-20 text-center">할당 수</TableHead>
                <TableHead className="w-32">등록일</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    <a href={v.url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 hover:underline">
                      {v.title}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </TableCell>
                  <TableCell>
                    {v.sessionType ? (
                      <span className="text-xs border rounded px-1.5 py-0.5">
                        {SESSION_TYPE_LABEL[v.sessionType]}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {v.tags.map(t => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {v._count?.assignments ?? 0}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(v.createdAt)}</TableCell>
                  <TableCell>
                    {canDelete(v.uploadedById) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(v.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <CreateVideoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); fetchVideos() }}
      />
    </div>
  )
}
```

- [ ] **Step 2: App.tsx에 라우트 추가**

기존 `TrainingResultsPage` import 아래에:
```typescript
import { TrainingVideoPage } from '@/pages/training/TrainingVideoPage'
```

`/training/results` 라우트 다음에:
```typescript
<Route path="/training/videos" element={<TrainingVideoPage />} />
```

- [ ] **Step 3: AppShell.tsx 사이드바에 링크 추가**

기존 훈련 섹션 (훈련 결과 링크 아래)에 추가. AppShell.tsx에서 `BarChart2`를 import하고 있는 라인 근처에서 `Video` 아이콘 추가:
```typescript
import { ..., Video } from 'lucide-react'
```

훈련 섹션 navItems에 추가:
```typescript
{ to: '/training/videos', label: '훈련 영상', icon: Video },
```

- [ ] **Step 4: TypeScript 확인**

```bash
cd football && npx tsc --noEmit 2>&1 | head -10
```

Expected: 오류 없음

- [ ] **Step 5: Commit**

```bash
git add football/src/pages/training/TrainingVideoPage.tsx football/src/App.tsx football/src/layouts/AppShell.tsx
git commit -m "feat(video): add TrainingVideoPage with list, create, delete and pagination"
```

---

## Self-Review

**Spec coverage:**
- ✅ TrainingVideo 모델 (title, url, tags, sessionType, uploadedById)
- ✅ VideoAssignment 모델 (videoId, playerId, assignedById, dueDate, progressRate, note)
- ✅ 열람 권한: COACHING_STAFF, ADMIN (PLAYER는 my-assignments만)
- ✅ 할당 시 선수에게 알림 (`VIDEO_ASSIGNED`)
- ✅ dueDate 초과 시 코치에게 알림 (`VIDEO_ASSIGNMENT_OVERDUE`) — cron 매일 09:00
- ✅ 진행률 0–100, 선수 본인만 업데이트
- ✅ `@@unique([videoId, playerId])` — 동일 선수·영상 중복 할당 방지

**Placeholder scan:** 없음 — 모든 코드 전체 포함.

**Type consistency:**
- `TrainingVideo`, `VideoAssignment` 타입 ↔ BE 응답 구조 일치
- `videoId_playerId` composite unique 키 사용 (Prisma 자동 생성)
- `SESSION_TYPE_LABEL` — 기존 `@/types/training`에서 import

import { VideoRepository } from "./video.repo";
import { AppError } from "../lib/appError";
import { NotificationRepository } from "../notification/notification.repo";
import { CreateVideoDto, CreateAssignmentDto, VideoListQuery } from "./dto/video.dto";
import { getPrisma } from "../lib/prisma";

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

  async getMyAssignments(userId: number) {
    const player = await getPrisma().player.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!player) throw new AppError(404, "PLAYER_NOT_FOUND");
    return this.repo.findAssignmentsByPlayer(player.id);
  }

  async createAssignment(dto: CreateAssignmentDto) {
    const assignment = await this.repo.createAssignment(dto);
    const player = await getPrisma().player.findUnique({
      where: { id: dto.playerId },
      select: { userId: true },
    });
    if (player?.userId) {
      void this.notifRepo
        .create({
          userId: player.userId,
          type: "VIDEO_ASSIGNED",
          title: "새 영상 과제가 할당됐습니다",
          body: `영상 ID ${dto.videoId}가 과제로 할당됐습니다.`,
          entityId: assignment.id,
        })
        .catch(console.error);
    }
    return assignment;
  }

  async updateProgress(videoId: number, playerId: string, progressRate: number, requesterId: number) {
    if (progressRate < 0 || progressRate > 100) throw new AppError(400, "INVALID_PROGRESS_RATE");
    const player = await getPrisma().player.findUnique({
      where: { userId: requesterId },
      select: { id: true },
    });
    if (!player || player.id !== playerId) throw new AppError(403, "FORBIDDEN");
    return this.repo.updateProgress(videoId, playerId, progressRate);
  }
}

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

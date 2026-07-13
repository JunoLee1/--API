import { NotificationRepository } from "./notification.repo";
import { AppError } from "../lib/appError";

export class NotificationService {
  constructor(private repo: NotificationRepository) {}

  getMyNotifications(userId: number) {
    return this.repo.findByUserId(userId);
  }

  async markRead(id: number, userId: number) {
    const count = await this.repo.markRead(id, userId);
    if (count.count === 0) throw new AppError(404, "NOTIFICATION_NOT_FOUND");
    return { ok: true };
  }
}

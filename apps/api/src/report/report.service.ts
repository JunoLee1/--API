import { ReportRepository } from "./report.repo";
import { NotificationRepository } from "../notification/notification.repo";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
import { getIO } from "../lib/io";

export class ReportService {
  constructor(
    private repo: ReportRepository,
    private notifRepo: NotificationRepository,
  ) {}

  list(userId: number, isGM: boolean, isHeadCoach: boolean = false) {
    return this.repo.findAll(userId, isGM, isHeadCoach);
  }

  async get(id: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    return report;
  }

  create(data: { authorId: number; type: string; title: string; content: string; fileUrl?: string; fileName?: string }) {
    return this.repo.create(data);
  }

  async update(id: number, userId: number, data: { title?: string; content?: string; fileUrl?: string; fileName?: string }) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.authorId !== userId) throw new AppError(403, "FORBIDDEN");
    if (report.status !== "DRAFT" && report.status !== "REJECTED") throw new AppError(409, "INVALID_STATUS");
    return this.repo.update(id, data);
  }

  async submit(id: number, userId: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.authorId !== userId) throw new AppError(403, "FORBIDDEN");
    if (report.status !== "DRAFT" && report.status !== "REJECTED") throw new AppError(409, "INVALID_STATUS");

    const submitted = await this.repo.submit(id);

    try {
      getIO().to("staff-room").emit("notification:report-submitted", {
        reportId: id,
        title: report.title,
        authorId: userId,
      });
    } catch {
      // socket not critical
    }

    await this.notifRepo.createForGM(
      "REPORT_SUBMITTED",
      "새 보고서가 제출됐습니다",
      `"${report.title}" 보고서가 결재 대기 중입니다.`,
      id,
    );

    return submitted;
  }

  async approve(id: number, reviewerId: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.status !== "SUBMITTED") throw new AppError(409, "NOT_SUBMITTED");

    const approved = await this.repo.approve(id, reviewerId);

    await writeAuditLog({
      actorId: reviewerId,
      action: "REPORT_APPROVED",
      targetId: id,
      detail: { title: report.title },
    });

    return approved;
  }

  async reject(id: number, reviewerId: number, reason: string) {
    if (!reason?.trim()) throw new AppError(400, "REJECTION_REASON_REQUIRED");
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.status !== "SUBMITTED") throw new AppError(409, "NOT_SUBMITTED");

    const rejected = await this.repo.reject(id, reviewerId, reason.trim());

    await writeAuditLog({
      actorId: reviewerId,
      action: "REPORT_REJECTED",
      targetId: id,
      detail: { title: report.title, reason: reason.trim() },
    });

    void this.notifRepo
      .createForUser(
        report.authorId,
        "REPORT_REJECTED",
        "보고서가 반려됐습니다",
        `"${report.title}" 보고서가 반려됐습니다. 사유: ${reason.trim()}`,
        id,
      )
      .catch(console.error);

    return rejected;
  }
}

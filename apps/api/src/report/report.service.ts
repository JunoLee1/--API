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

  list(userId: number, isGM: boolean, isHeadCoach: boolean = false, filters: { type?: string; status?: string } = {}, deptCategories: string[] = []) {
    return this.repo.findAll(userId, isGM, isHeadCoach, filters, deptCategories);
  }

  async get(id: number) {
    const report = await this.repo.findById(id);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    return report;
  }

  create(data: { authorId: number; type: string; title: string; content: string; fileUrl?: string; fileName?: string; departmentId?: number }) {
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

    // Auto-assign reviewers based on ReviewRuleSet
    const rules = await this.repo.findRulesByType(report.type);
    let reviewerDeptIds: number[] = [];
    if (rules.length > 0) {
      const categories = rules.map((r) => r.reviewerCategory as string);
      const depts = await this.repo.findDeptsByCategory(categories);
      reviewerDeptIds = depts.map((d) => d.id);
    }

    const submitted = await this.repo.submitWithReviews(id, reviewerDeptIds);

    try {
      getIO().to("staff-room").emit("notification:report-submitted", { reportId: id, title: report.title, authorId: userId });
    } catch {
      // socket not critical
    }

    await this.notifRepo.createForGM(
      "REPORT_SUBMITTED",
      () => ({ title: "새 보고서가 제출됐습니다", body: `"${report.title}" 보고서가 결재 대기 중입니다.` }),
      id,
    );

    return submitted;
  }

  async confirmReview(reportId: number, reviewerDeptId: number, userId: number, comment?: string) {
    const report = await this.repo.findById(reportId);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.status !== "REVIEWING") throw new AppError(409, "INVALID_STATUS");

    const review = await this.repo.findReview(reportId, reviewerDeptId);
    if (!review) throw new AppError(404, "REVIEW_NOT_FOUND");
    if (review.status !== "PENDING") throw new AppError(409, "ALREADY_REVIEWED");

    const result = await this.repo.confirmReview(reportId, reviewerDeptId, userId, comment);

    await writeAuditLog({ actorId: userId, action: "REPORT_REVIEW_CONFIRMED", targetId: reportId, detail: { reviewerDeptId, comment } });

    return result;
  }

  async rejectReview(reportId: number, reviewerDeptId: number, userId: number, reason: string) {
    if (!reason?.trim()) throw new AppError(400, "REJECTION_REASON_REQUIRED");

    const report = await this.repo.findById(reportId);
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND");
    if (report.status !== "REVIEWING") throw new AppError(409, "INVALID_STATUS");

    const review = await this.repo.findReview(reportId, reviewerDeptId);
    if (!review) throw new AppError(404, "REVIEW_NOT_FOUND");
    if (review.status !== "PENDING") throw new AppError(409, "ALREADY_REVIEWED");

    const result = await this.repo.rejectReview(reportId, reviewerDeptId, userId, reason.trim());

    await writeAuditLog({ actorId: userId, action: "REPORT_REVIEW_REJECTED", targetId: reportId, detail: { reviewerDeptId, reason } });

    void this.notifRepo
      .createForUser(
        report.authorId,
        "REPORT_REJECTED",
        () => ({ title: "보고서가 반려됐습니다", body: `"${report.title}" 보고서가 반려됐습니다. 사유: ${reason.trim()}` }),
        reportId,
      )
      .catch(console.error);

    return result;
  }

  listRuleSets() {
    return this.repo.listRuleSets();
  }

  async createRuleSet(reportType: string, reviewerCategory: string) {
    const valid = ["PERFORMANCE", "MEDICAL", "TRAINING", "HR", "FINANCIAL", "ASSET"];
    if (!valid.includes(reportType)) throw new AppError(400, "INVALID_REPORT_TYPE");
    return this.repo.createRuleSet(reportType, reviewerCategory);
  }

  async deleteRuleSet(id: number) {
    const rule = await this.repo.listRuleSets().then((r) => r.find((x) => x.id === id));
    if (!rule) throw new AppError(404, "RULE_NOT_FOUND");
    return this.repo.deleteRuleSet(id);
  }
}

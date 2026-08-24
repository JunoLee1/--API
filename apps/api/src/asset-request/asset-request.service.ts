import { PrismaClient } from "../generated/client";
import { AppError } from "../lib/appError";
import { writeAuditLog } from "../lib/auditLog";
import { isAdminLike } from "../lib/permissions";
import { NotificationRepository } from "../notification/notification.repo";
import { OperatingExpenseRepository } from "../operating-expense/operating-expense.repo";
import { AssetRequestRepository } from "./asset-request.repo";
import { CreateAssetRequestDto } from "./dto/asset-request.dto";

/**
 * Two-stage department approval for asset requests.
 *
 * Flow:
 *   DRAFT → SUBMITTED → LEADER_APPROVED → APPROVED → FULFILLED
 *                ↓            ↓                  ↓
 *            CANCELLED  LEADER_REJECTED     REJECTED
 *
 * Leader = requester's leaf `Department.head` (팀장).
 * Dept-head = requester's leaf `Department.parent.head` (부서장).
 * At dept-head approve, an `OperatingExpense` (status=PENDING) is auto-created
 * against a matching APPROVED BudgetLine — dept-scoped first, then club-wide.
 * BUDGET_EXCEEDED propagates as 409 (Q5-2 Y).
 */
export class AssetRequestService {
  constructor(
    private repo: AssetRequestRepository,
    private expenseRepo: OperatingExpenseRepository,
    private notifRepo: NotificationRepository,
    private prisma: PrismaClient,
  ) {}

  // ────────────────────────────────────────────
  // Read
  // ────────────────────────────────────────────

  async getById(id: number) {
    const request = await this.repo.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND");
    return request;
  }

  async list(
    userId: number,
    role: string,
    filter?: "me" | "pending-leader" | "pending-dept-head" | "all",
    status?: string,
  ) {
    const asStatus = status as any;
    switch (filter) {
      case "me":
        return this.repo.findByRequester(userId, asStatus);
      case "pending-leader":
        return this.repo.findPendingForLeader(userId);
      case "pending-dept-head":
        return this.repo.findPendingForDeptHead(userId);
      case "all":
        if (!isAdminLike(role)) throw new AppError(403, "FORBIDDEN");
        return this.repo.findAll(asStatus);
      default:
        // default = requester's own list
        return this.repo.findByRequester(userId, asStatus);
    }
  }

  // ────────────────────────────────────────────
  // Create
  // ────────────────────────────────────────────

  async create(dto: CreateAssetRequestDto, requesterId: number) {
    // Payload alignment first — the hybrid rule (Q2-i c): exactly one of
    // equipmentItemId / softwareLicenseId / customName.
    const payloadKeys = [
      dto.equipmentItemId !== undefined ? "equipmentItemId" : null,
      dto.softwareLicenseId !== undefined ? "softwareLicenseId" : null,
      dto.customName !== undefined && dto.customName.trim() !== "" ? "customName" : null,
    ].filter((k): k is string => k !== null);
    if (payloadKeys.length !== 1) throw new AppError(400, "INVALID_PAYLOAD");

    // Type/master alignment: SOFTWARE ↔ softwareLicenseId only, HARDWARE ↔
    // equipmentItemId only. customName is allowed with either type.
    if (dto.type === "SOFTWARE" && dto.equipmentItemId !== undefined) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }
    if (dto.type === "HARDWARE" && dto.softwareLicenseId !== undefined) {
      throw new AppError(400, "INVALID_PAYLOAD");
    }

    if (!Number.isFinite(dto.expectedAmount) || dto.expectedAmount <= 0) {
      throw new AppError(400, "INVALID_AMOUNT");
    }
    if (!dto.justification || dto.justification.trim() === "") {
      throw new AppError(400, "JUSTIFICATION_REQUIRED");
    }

    // Resolve requester's leaf department via UserDepartment.
    // Convention: MEMBER row = leaf. If a user belongs to multiple depts we take
    // the most recent membership (joinedAt desc). Admins without membership
    // cannot file — 400 tells the caller to have their dept lead add them.
    const membership = await this.prisma.userDepartment.findFirst({
      where: { userId: requesterId },
      orderBy: { joinedAt: "desc" },
      select: { departmentId: true },
    });
    if (!membership) throw new AppError(400, "NO_DEPARTMENT");

    return this.repo.create(dto, requesterId, membership.departmentId);
  }

  // ────────────────────────────────────────────
  // Requester actions
  // ────────────────────────────────────────────

  async submit(id: number, userId: number) {
    const request = await this.repo.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND");
    if (request.requesterId !== userId) throw new AppError(403, "NOT_YOUR_REQUEST");
    if (request.status !== "DRAFT") throw new AppError(400, "INVALID_STATUS");

    const updated = await this.repo.updateStatus(id, { status: "SUBMITTED" });

    writeAuditLog({
      actorId: userId,
      action: "ASSET_REQUEST_SUBMITTED",
      targetId: id,
      detail: { type: request.type, expectedAmount: request.expectedAmount },
    }).catch(console.error);

    // Notify the leader (leaf dept.head). We don't yet have a dedicated
    // NotificationType enum value — Task 5 will add one. For now use
    // FINANCE_SUBMIT_REQUIRED as a stand-in generic "action required".
    const leaderId = request.department.headId;
    if (leaderId && leaderId !== userId) {
      // TODO(Task 5): swap for a dedicated `ASSET_REQUEST_LEADER_PENDING` enum.
      await this.notifRepo.createForUser(
        leaderId,
        "FINANCE_SUBMIT_REQUIRED",
        (lang) => ({
          title: lang === "en" ? "Asset Request Awaiting Your Approval" : "자산 신청 결재 대기",
          body:
            lang === "en"
              ? `Asset request #${id} for ₩${request.expectedAmount.toLocaleString()} awaits your approval.`
              : `자산 신청 #${id} (₩${request.expectedAmount.toLocaleString()})이 팀장 결재를 기다립니다.`,
        }),
        id,
      );
    }

    return updated;
  }

  async cancel(id: number, userId: number) {
    const request = await this.repo.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND");
    if (request.requesterId !== userId) throw new AppError(403, "NOT_YOUR_REQUEST");
    // LEADER_APPROVED is considered committed downstream — cancellation would
    // strand the pending approval trail. Only DRAFT / SUBMITTED are cancellable.
    if (!["DRAFT", "SUBMITTED"].includes(request.status)) {
      throw new AppError(400, "INVALID_STATUS");
    }

    const updated = await this.repo.updateStatus(id, { status: "CANCELLED" });

    writeAuditLog({
      actorId: userId,
      action: "ASSET_REQUEST_CANCELLED",
      targetId: id,
      detail: { previousStatus: request.status },
    }).catch(console.error);

    return updated;
  }

  // ────────────────────────────────────────────
  // Leader (leaf dept.head) approvals
  // ────────────────────────────────────────────

  async leaderApprove(id: number, reviewerId: number) {
    const request = await this.repo.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND");
    if (request.status !== "SUBMITTED") throw new AppError(400, "INVALID_STATUS");
    if (request.department.headId !== reviewerId) throw new AppError(403, "NOT_LEADER");
    if (request.requesterId === reviewerId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN");

    await this.repo.addApproval(id, {
      stage: "LEADER",
      action: "APPROVED",
      reviewerId,
    });
    const updated = await this.repo.updateStatus(id, { status: "LEADER_APPROVED" });

    writeAuditLog({
      actorId: reviewerId,
      action: "ASSET_REQUEST_LEADER_APPROVED",
      targetId: id,
      detail: { requesterId: request.requesterId },
    }).catch(console.error);

    const deptHeadId = request.department.parent?.headId;
    if (deptHeadId && deptHeadId !== reviewerId) {
      // TODO(Task 5): dedicated `ASSET_REQUEST_DEPT_HEAD_PENDING` enum.
      await this.notifRepo.createForUser(
        deptHeadId,
        "FINANCE_SUBMIT_REQUIRED",
        (lang) => ({
          title: lang === "en" ? "Asset Request Awaiting Dept-Head Approval" : "자산 신청 부서장 결재 대기",
          body:
            lang === "en"
              ? `Asset request #${id} for ₩${request.expectedAmount.toLocaleString()} awaits your approval.`
              : `자산 신청 #${id} (₩${request.expectedAmount.toLocaleString()})이 부서장 결재를 기다립니다.`,
        }),
        id,
      );
    }

    return updated;
  }

  async leaderReject(id: number, reviewerId: number, reason: string) {
    const trimmed = reason?.trim();
    if (!trimmed) throw new AppError(400, "REASON_REQUIRED");

    const request = await this.repo.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND");
    if (request.status !== "SUBMITTED") throw new AppError(400, "INVALID_STATUS");
    if (request.department.headId !== reviewerId) throw new AppError(403, "NOT_LEADER");
    if (request.requesterId === reviewerId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN");

    await this.repo.addApproval(id, {
      stage: "LEADER",
      action: "REJECTED",
      reviewerId,
      reason: trimmed,
    });
    const updated = await this.repo.updateStatus(id, { status: "LEADER_REJECTED" });

    writeAuditLog({
      actorId: reviewerId,
      action: "ASSET_REQUEST_LEADER_REJECTED",
      targetId: id,
      detail: { reason: trimmed, requesterId: request.requesterId },
    }).catch(console.error);

    // TODO(Task 5): dedicated `ASSET_REQUEST_LEADER_REJECTED` enum.
    await this.notifRepo.createForUser(
      request.requesterId,
      "FINANCE_SUBMIT_REQUIRED",
      (lang) => ({
        title: lang === "en" ? "Asset Request Rejected by Leader" : "자산 신청 팀장 반려",
        body:
          lang === "en"
            ? `Your asset request #${id} was rejected: ${trimmed}`
            : `자산 신청 #${id}이 팀장에 의해 반려됐습니다: ${trimmed}`,
      }),
      id,
    );

    return updated;
  }

  // ────────────────────────────────────────────
  // Dept-head (parent dept.head) approvals
  // ────────────────────────────────────────────

  async approve(id: number, reviewerId: number) {
    const request = await this.repo.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND");
    if (request.status !== "LEADER_APPROVED") throw new AppError(400, "INVALID_STATUS");
    if (request.department.parent?.headId !== reviewerId) throw new AppError(403, "NOT_DEPT_HEAD");
    if (request.requesterId === reviewerId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN");

    // Active season is required — we bind the OperatingExpense to it.
    const season = await this.prisma.season.findFirst({ where: { status: "ACTIVE" } });
    if (!season) throw new AppError(400, "NO_ACTIVE_SEASON");

    // Auto-match BudgetLine (Q5-1 c): dept-scoped first, then club-wide.
    const now = new Date();
    let budgetLine = await this.expenseRepo.findBudgetLineForSeasonCategoryDept({
      seasonId: season.id,
      categoryId: request.expenseCategoryId,
      departmentId: request.departmentId,
      date: now,
    });
    if (!budgetLine) {
      budgetLine = await this.expenseRepo.findBudgetLineForSeasonCategoryDept({
        seasonId: season.id,
        categoryId: request.expenseCategoryId,
        departmentId: null,
        date: now,
      });
    }
    if (!budgetLine) throw new AppError(400, "BUDGET_LINE_NOT_FOUND");

    // Create the OperatingExpense with budget check. BUDGET_EXCEEDED propagates
    // as 409; other errors bubble through unchanged.
    let expense;
    try {
      expense = await this.expenseRepo.createWithBudgetCheck({
        seasonId: season.id,
        categoryId: request.expenseCategoryId,
        costType: "VARIABLE",
        amount: request.expectedAmount,
        date: now,
        note: `Asset request #${id}`,
        createdById: reviewerId,
        budgetLineId: budgetLine.id,
      });
    } catch (err: any) {
      if (err?.message === "BUDGET_EXCEEDED") throw new AppError(409, "BUDGET_EXCEEDED");
      if (err?.message === "BUDGET_LINE_NOT_FOUND") throw new AppError(400, "BUDGET_LINE_NOT_FOUND");
      if (err?.message === "CATEGORY_MISMATCH") throw new AppError(400, "CATEGORY_MISMATCH");
      throw err;
    }

    // Attach the operating expense to the request and mark APPROVED.
    // NOTE: OperatingExpense.departmentId is a separate column (Task 2 addition)
    // but createWithBudgetCheck doesn't yet accept it — the department tag is
    // implicit via the BudgetLine.departmentId. Backfill left for a follow-up.
    await this.repo.addApproval(id, {
      stage: "DEPT_HEAD",
      action: "APPROVED",
      reviewerId,
    });
    const updated = await this.repo.updateStatus(id, {
      status: "APPROVED",
      operatingExpenseId: expense.id,
    });

    writeAuditLog({
      actorId: reviewerId,
      action: "ASSET_REQUEST_APPROVED",
      targetId: id,
      detail: {
        operatingExpenseId: expense.id,
        budgetLineId: budgetLine.id,
        amount: request.expectedAmount,
      },
    }).catch(console.error);

    // Notify finance (they will execute payment) + requester.
    await this.notifRepo.createForFinanceStaff(
      "FINANCE_SUBMIT_REQUIRED",
      (lang) => ({
        title: lang === "en" ? "Asset Request Approved (Payment Pending)" : "자산 신청 승인 (지급 대기)",
        body:
          lang === "en"
            ? `Asset request #${id} approved — ₩${request.expectedAmount.toLocaleString()} awaits payment.`
            : `자산 신청 #${id} 승인 완료. ₩${request.expectedAmount.toLocaleString()} 지급 대기 중입니다.`,
      }),
      id,
    );
    await this.notifRepo.createForUser(
      request.requesterId,
      "FINANCE_SUBMIT_REQUIRED",
      (lang) => ({
        title: lang === "en" ? "Asset Request Approved" : "자산 신청 승인",
        body:
          lang === "en"
            ? `Your asset request #${id} for ₩${request.expectedAmount.toLocaleString()} has been approved.`
            : `자산 신청 #${id} (₩${request.expectedAmount.toLocaleString()})이 승인됐습니다.`,
      }),
      id,
    );

    return updated;
  }

  async reject(id: number, reviewerId: number, reason: string) {
    const trimmed = reason?.trim();
    if (!trimmed) throw new AppError(400, "REASON_REQUIRED");

    const request = await this.repo.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND");
    if (request.status !== "LEADER_APPROVED") throw new AppError(400, "INVALID_STATUS");
    if (request.department.parent?.headId !== reviewerId) throw new AppError(403, "NOT_DEPT_HEAD");
    if (request.requesterId === reviewerId) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN");

    await this.repo.addApproval(id, {
      stage: "DEPT_HEAD",
      action: "REJECTED",
      reviewerId,
      reason: trimmed,
    });
    const updated = await this.repo.updateStatus(id, { status: "REJECTED" });

    writeAuditLog({
      actorId: reviewerId,
      action: "ASSET_REQUEST_REJECTED",
      targetId: id,
      detail: { reason: trimmed, requesterId: request.requesterId },
    }).catch(console.error);

    await this.notifRepo.createForUser(
      request.requesterId,
      "FINANCE_SUBMIT_REQUIRED",
      (lang) => ({
        title: lang === "en" ? "Asset Request Rejected" : "자산 신청 반려",
        body:
          lang === "en"
            ? `Your asset request #${id} was rejected: ${trimmed}`
            : `자산 신청 #${id}이 반려됐습니다: ${trimmed}`,
      }),
      id,
    );

    return updated;
  }

  // ────────────────────────────────────────────
  // Fulfillment (management)
  // ────────────────────────────────────────────

  /**
   * Marks the request as FULFILLED. Only APPROVED requests are eligible.
   *
   * Role gate (Q4 doesn't lock this): ADMIN-like OR the type-matched manager.
   *   - HARDWARE → EQUIPMENT_MANAGER
   *   - SOFTWARE → ASSET_MANAGER
   * Since no `canFulfillAsset` helper exists yet in permissions.ts, we inline
   * the check here. TODO: extract to permissions.ts once a second caller
   * appears (Task 5 or 6).
   *
   * If the request was custom (no master link) we create the corresponding
   * Equipment/SoftwareLicense record and link it back so the master catalog
   * reflects the newly-purchased asset.
   */
  async fulfill(
    id: number,
    userId: number,
    role: string,
    foRole: string | null | undefined,
  ) {
    const request = await this.repo.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND");
    if (request.status !== "APPROVED") throw new AppError(400, "INVALID_STATUS");

    const isAdmin = isAdminLike(role);
    const isEquipmentMgr =
      role === "FRONT_OFFICE" && (foRole === "EQUIPMENT_MANAGER" || foRole === "ASSET_MANAGER");
    const isSoftwareMgr =
      role === "FRONT_OFFICE" && (foRole === "ASSET_MANAGER" || foRole === "ASSET_STAFF");

    if (!isAdmin) {
      if (request.type === "HARDWARE" && !isEquipmentMgr) throw new AppError(403, "FORBIDDEN");
      if (request.type === "SOFTWARE" && !isSoftwareMgr) throw new AppError(403, "FORBIDDEN");
    }

    // Custom payload → create master record and link back.
    if (request.customName && !request.equipmentItemId && !request.softwareLicenseId) {
      if (request.type === "HARDWARE") {
        const item = await this.prisma.equipmentItem.create({
          data: {
            name: request.customName,
            category: "OTHER",
            trackedIndividually: false,
            quantity: 1,
          },
        });
        await this.repo.linkEquipmentItem(id, item.id);
      } else {
        const license = await this.prisma.softwareLicense.create({
          data: {
            name: request.customName,
            vendor: request.customDescription ?? "(unspecified)",
            totalSeats: 1,
            usedSeats: 0,
            createdById: userId,
          },
        });
        await this.repo.linkSoftwareLicense(id, license.id);
      }
    }

    const updated = await this.repo.updateStatus(id, { status: "FULFILLED" });

    writeAuditLog({
      actorId: userId,
      action: "ASSET_REQUEST_FULFILLED",
      targetId: id,
      detail: { type: request.type, requesterId: request.requesterId },
    }).catch(console.error);

    return updated;
  }
}

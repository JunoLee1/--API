import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { DepartmentPlanRepository } from "./department-plan.repo";
import {
  CreateDepartmentPlanDto,
  UpdateDepartmentPlanDto,
  ListDepartmentPlanQuery,
} from "./dto/department-plan.dto";

export class DepartmentPlanService {
  constructor(private repo: DepartmentPlanRepository) {}

  list(filters: ListDepartmentPlanQuery) {
    return this.repo.findAll(filters);
  }

  async getById(id: number) {
    const plan = await this.repo.findById(id);
    if (!plan) throw new AppError(404, "DEPARTMENT_PLAN_NOT_FOUND");
    return plan;
  }

  create(dto: CreateDepartmentPlanDto, createdById: number) {
    return this.repo.create(dto, createdById);
  }

  async update(id: number, dto: UpdateDepartmentPlanDto, userId: number, userRole: string, foRole?: string | null) {
    const plan = await this.getById(id);
    // DRAFT 상태: 해당 부서 소속 멤버 or FINANCE_MANAGER/STAFF or GM/ADMIN
    // REVIEWING 상태: FINANCE_MANAGER/STAFF or GM/ADMIN만 가능
    if (plan.status === "APPROVED") {
      throw new AppError(409, "CANNOT_MODIFY_APPROVED_PLAN");
    }
    if (plan.status === "REVIEWING") {
      const canEdit =
        isAdminLike(userRole) ||
        (userRole === "FRONT_OFFICE" &&
          (foRole === "FINANCE_MANAGER" || foRole === "FINANCE_STAFF"));
      if (!canEdit) throw new AppError(403, "FORBIDDEN");
    }
    return this.repo.update(id, dto);
  }

  async submit(id: number, userId: number) {
    const plan = await this.getById(id);
    if (plan.status !== "DRAFT") {
      throw new AppError(409, "CANNOT_SUBMIT_NON_DRAFT");
    }
    // 부서장만 제출 가능
    if (plan.department.headId !== userId) {
      throw new AppError(403, "ONLY_HEAD_CAN_SUBMIT");
    }
    return this.repo.submit(id);
  }

  async approve(id: number, userId: number, userRole: string) {
    if (!isAdminLike(userRole)) throw new AppError(403, "FORBIDDEN");
    const plan = await this.getById(id);
    if (plan.status !== "REVIEWING") {
      throw new AppError(409, "CANNOT_APPROVE_NON_REVIEWING");
    }
    return this.repo.approve(id, userId);
  }

  async reject(id: number, userId: number, userRole: string, reason: string) {
    if (!isAdminLike(userRole)) throw new AppError(403, "FORBIDDEN");
    if (!reason?.trim()) throw new AppError(400, "REJECTION_REASON_REQUIRED");
    const plan = await this.getById(id);
    if (plan.status !== "REVIEWING") {
      throw new AppError(409, "CANNOT_REJECT_NON_REVIEWING");
    }
    return this.repo.reject(id, userId, reason);
  }

  getBudgetSummary(seasonId: number) {
    return this.repo.budgetSummary(seasonId);
  }
}

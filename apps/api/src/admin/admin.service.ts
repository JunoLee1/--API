import { AdminRepository } from "./admin.repo";
import { AppError } from "../lib/appError";
import { ListUsersQuery, UpdateUserRoleDto, PlayerWithoutAccountDto } from "./dto/admin.dto";

export class AdminService {
  constructor(private repo: AdminRepository) {}

  async listUsers(filters: ListUsersQuery) {
    return this.repo.listUsers(filters);
  }

  async getPlayersWithoutAccounts(nameFilter?: string): Promise<PlayerWithoutAccountDto[]> {
    return this.repo.findPlayersWithoutAccounts(nameFilter);
  }

  async getUserById(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");
    return user;
  }

  async updateUserRole(id: number, dto: UpdateUserRoleDto, requesterId: number, requesterRole: string) {
    if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");
    if (dto.role === "SUPER_ADMIN" && requesterRole !== "SUPER_ADMIN") {
      throw new AppError(403, "ONLY_SUPER_ADMIN_CAN_GRANT_SUPER_ADMIN");
    }

    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    const coachingRole = dto.role === "COACHING_STAFF" ? (dto.coachingRole ?? null) : null;
    const frontOfficeRole = dto.role === "FRONT_OFFICE" ? (dto.frontOfficeRole ?? null) : null;

    return this.repo.updateRole(id, dto.role, coachingRole, frontOfficeRole, dto.clubId);
  }

  async deactivateUser(id: number, requesterId: number) {
    if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");

    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    return this.repo.setDeleted(id, true);
  }

  async reactivateUser(id: number) {
    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    return this.repo.setDeleted(id, false);
  }

  async deleteUser(id: number, requesterId: number) {
    if (id === requesterId) throw new AppError(403, "CANNOT_MODIFY_SELF");

    const user = await this.repo.findById(id);
    if (!user) throw new AppError(404, "USER_NOT_FOUND");

    const linked = await this.repo.getLinkedData(id);
    if (!linked) throw new AppError(404, "USER_NOT_FOUND");

    const hasLinkedData =
      linked.player !== null ||
      linked._count.managedContracts > 0 ||
      linked._count.createdSessions > 0 ||
      linked._count.approvedSessions > 0 ||
      linked._count.tacticalAnalyses > 0 ||
      linked._count.managedInjuries > 0 ||
      linked._count.agentPlayers > 0 ||
      linked._count.recallRequests > 0 ||
      linked._count.recallApprovals > 0;

    if (hasLinkedData) throw new AppError(409, "USER_HAS_LINKED_DATA");

    await this.repo.hardDelete(id);
  }

  async getAuditLogs(filters: {
    actorId?: number;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const [logs, total] = await Promise.all([
      this.repo.listAuditLogs(filters),
      this.repo.countAuditLogs(filters),
    ]);
    return { logs, total };
  }
}

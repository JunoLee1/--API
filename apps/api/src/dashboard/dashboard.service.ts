import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";
import { DashboardRepository } from "./dashboard.repo";

type UserCtx = {
  id: number;
  role: Role;
  coachingRole: CoachingRole | null | undefined;
  frontOfficeRole: FrontOfficeRole | null | undefined;
};

export class DashboardService {
  constructor(private repo: DashboardRepository) {}

  getYouthDevelopmentStats() {
    return this.repo.getYouthDevelopmentStats();
  }

  getAcademyFinanceStats(year: number, month: number) {
    return this.repo.getAcademyFinanceStats(year, month);
  }

  getStats(user: UserCtx) {
    switch (user.role) {
      case "ADMIN":
      case "SUPER_ADMIN":
        return this.repo.getAdminStats();
      case "FRONT_OFFICE":
        return this.getFrontOfficeStats(user);
      case "COACHING_STAFF":
        return this.getCoachingStats(user);
      case "PLAYER":
        return this.repo.getPlayerStats(user.id);
      case "AGENT":
        return this.repo.getAgentStats(user.id);
      default:
        throw new Error(`Unknown role: ${(user as any).role}`);
    }
  }

  private getFrontOfficeStats(user: UserCtx) {
    switch (user.frontOfficeRole) {
      case "GM":
        return this.repo.getGmStats();
      case "TD":
        return this.repo.getTdStats();
      case "CONTRACT_MANAGER":
        return this.repo.getContractManagerStats();
      case "SCOUT":
        return this.repo.getScoutStats();
      case "EQUIPMENT_MANAGER":
        return this.repo.getEquipmentManagerStats();
      case "TACTICAL_ANALYST":
        return this.repo.getTacticalAnalystStats(user.id);
      case "HR_MANAGER":
        return this.repo.getHrManagerStats();
      case "FINANCE_MANAGER":
        return this.repo.getFinanceManagerStats();
      case "ASSET_MANAGER":
        return this.repo.getAssetManagerStats();
      default:
        throw new Error(`Unknown frontOfficeRole: ${user.frontOfficeRole}`);
    }
  }

  private async getCoachingStats(user: UserCtx) {
    switch (user.coachingRole) {
      case "HEAD_COACH": {
        const [roleStats, medicalDashboard] = await Promise.all([
          this.repo.getHeadCoachStats(),
          this.repo.getMedicalDashboardStats(),
        ]);
        return { ...roleStats, medicalDashboard };
      }
      case "ASSISTANT_COACH":
        return this.repo.getHeadCoachStats();
      case "PHYSICAL_COACH":
        return this.repo.getPhysicalCoachStats(user.id);
      case "MEDICAL": {
        const [roleStats, medicalDashboard] = await Promise.all([
          this.repo.getMedicalStats(user.id),
          this.repo.getMedicalDashboardStats(),
        ]);
        return { ...roleStats, medicalDashboard };
      }
      case "MEDICAL_DIRECTOR": {
        const [roleStats, medicalDashboard] = await Promise.all([
          this.repo.getMedicalDirectorStats(user.id),
          this.repo.getMedicalDashboardStats(),
        ]);
        return { ...roleStats, medicalDashboard };
      }
      default:
        if (!user.coachingRole) throw new Error(`Missing coachingRole for COACHING_STAFF user ${user.id}`);
        return this.repo.getSpecialistCoachStats(user.coachingRole, user.id);
    }
  }
}

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

  getStats(user: UserCtx) {
    switch (user.role) {
      case "ADMIN":
        return this.repo.getAdminStats();
      case "FRONT_OFFICE":
        return this.getFrontOfficeStats(user);
      case "COACHING_STAFF":
        return this.getCoachingStats(user);
      case "PLAYER":
        return this.repo.getPlayerStats(user.id);
      case "AGENT":
        return this.repo.getAgentStats(user.id);
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
      default:
        return this.repo.getAdminStats();
    }
  }

  private getCoachingStats(user: UserCtx) {
    switch (user.coachingRole) {
      case "HEAD_COACH":
      case "ASSISTANT_COACH":
        return this.repo.getHeadCoachStats();
      case "PHYSICAL_COACH":
        return this.repo.getPhysicalCoachStats(user.id);
      case "MEDICAL":
        return this.repo.getMedicalStats(user.id);
      case "MEDICAL_DIRECTOR":
        return this.repo.getMedicalDirectorStats(user.id);
      default:
        return this.repo.getSpecialistCoachStats(user.coachingRole!, user.id);
    }
  }
}

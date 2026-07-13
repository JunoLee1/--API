import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";

declare global {
  namespace Express {
    interface User {
      id: number;
      role: Role;
      coachingRole?: CoachingRole | null;
      frontOfficeRole?: FrontOfficeRole | null;
    }
  }
}

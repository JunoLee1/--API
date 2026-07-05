import { Role } from "../generated/enums";

declare global {
  namespace Express {
    interface User {
      id: number;
      role: Role;
    }
  }
}

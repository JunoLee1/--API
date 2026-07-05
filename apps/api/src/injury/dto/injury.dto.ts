import { InjuryCause, InjuryStatus } from "../../generated/enums";

export interface CreateInjuryDto {
  playerId: string;
  bodyPart: string;
  cause: InjuryCause;
  expectedReturnDate?: string;
  medicalStaffId: number;
}

export interface UpdateInjuryStatusDto {
  status: InjuryStatus;
  expectedReturnDate?: string;
}

import { InjuryCause, InjuryStatus, HospitalType } from "../../generated/enums";

export interface CreateInjuryDto {
  playerId: string;
  bodyPart: string;
  cause: InjuryCause;
  expectedReturnDate?: string;
  medicalStaffId: number;
  hospitalType?: HospitalType;
  hospitalId?: number;
  customHospitalName?: string;
}

export interface UpdateInjuryStatusDto {
  status: InjuryStatus;
  expectedReturnDate?: string;
}

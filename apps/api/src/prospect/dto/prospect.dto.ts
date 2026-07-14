import { Foot, Position, ProspectStatus, VisaEligibility, WorkPermitStatus } from "../../generated/enums";

export interface CreateProspectDto {
  name: string;
  nationality?: string;
  position?: Position;
  currentTeam?: string;
  notes?: string;
  createdById?: number;
}

export interface UpdateProspectDto {
  name?: string;
  nationality?: string;
  position?: Position;
  currentTeam?: string;
  notes?: string;
  visaRequired?: boolean;
  visaEligibility?: VisaEligibility;
}

export interface TransitionProspectStatusDto {
  status: ProspectStatus;
}

export interface SignProspectDto {
  dateOfBirth: string;
  preferredFoot?: Foot;
  height: number;
  weight: number;
  nationalityId: number;
  position?: Position;
  contractStartDate: string;
  contractEndDate: string;
  salary: number;
  managedById?: number;
  workPermitStatus?: WorkPermitStatus;
  workPermitExpiry?: string;
}

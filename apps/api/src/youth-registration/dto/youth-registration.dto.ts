export interface CreateYouthRegistrationDto {
  playerName: string;
  birthDate: string;
  preferredJerseyNumber?: number;
  teamId: number;
  guardianEmail: string;
}

export interface RejectYouthRegistrationDto {
  rejectionReason: string;
}

export interface YouthRegistrationListQuery {
  teamId?: number;
  status?: "PENDING" | "GUARDIAN_APPROVED" | "CONTRACTED" | "REJECTED";
}

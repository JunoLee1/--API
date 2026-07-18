export interface CreateCoachAvailabilityDto {
  userId: number;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface CoachAvailabilityQuery {
  userId?: number;
  from?: string;
  to?: string;
}

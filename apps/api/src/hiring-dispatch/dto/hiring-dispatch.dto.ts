export interface CreateHiringDispatchDto {
  applicationId?: number;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  jobGrade: "INTERN" | "JUNIOR" | "ASSOCIATE" | "MANAGER" | "DIRECTOR" | "EXECUTIVE";
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "ADVISOR";
  departmentId: number;
  reportsToUserId?: number;
  // BigInt over the wire — accept number or string; service converts.
  monthlySalary: number | string;
  startDate: string;
  // Role enum value (e.g., "FRONT_OFFICE", "COACHING_STAFF", "ADMIN").
  targetRole: string;
  targetFrontOfficeRole?: string;
  targetCoachingRole?: string;
  permissionNotes?: string;
}

export interface BudgetReverifyDto {
  toOverride?: boolean;
  offerMismatchOverride?: boolean;
}

export interface RejectDto {
  reason: string;
}

export interface CancelDto {
  reason: string;
}

export interface ListHiringDispatchQuery {
  filter?: "me" | "pending-budget" | "pending-dispatch" | "pending-execution" | "all";
  status?: string;
}

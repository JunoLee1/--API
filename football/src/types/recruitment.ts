export type JobPostingStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
export type JobApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW_1'
  | 'INTERVIEW_2'
  | 'REFERENCE_CHECK'
  | 'OFFERED'
  | 'ONBOARDED'
  | 'REJECTED'
export type InterviewRound = 'ROUND_1' | 'ROUND_2'
export type InterviewResult = 'PENDING' | 'PASS' | 'FAIL'
export type ReferenceCheckResult = 'PENDING' | 'CLEAR' | 'FLAGGED'

export interface JobPosting {
  id: number
  title: string
  departmentId: number | null
  headcount: number
  description: string
  status: JobPostingStatus
  createdById: number
  approvedById: number | null
  approvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  // #372 — free-form list of document types required before HiringDispatch execution
  requiredDocuments?: string[]
  department: { id: number; name: string } | null
  createdBy: { id: number; username: string }
  approvedBy: { id: number; username: string } | null
  applications: JobApplication[]
}

export interface JobApplication {
  id: number
  postingId: number
  applicantName: string
  email: string
  phone: string | null
  resumeUrl: string | null
  status: JobApplicationStatus
  rejectedAt: string | null
  offeredAt: string | null
  offeredById: number | null
  createdAt: string
  updatedAt: string
  posting: { id: number; title: string }
  offeredBy: { id: number; username: string } | null
  interviews: Interview[]
  referenceCheck: ReferenceCheck | null
  onboarding: Onboarding | null
}

export interface Interview {
  id: number
  applicationId: number
  round: InterviewRound
  scheduledAt: string | null
  interviewerIds: number[]
  scoreSkill: number | null
  scoreComm: number | null
  scoreCulture: number | null
  comment: string | null
  result: InterviewResult
  createdAt: string
  updatedAt: string
}

export interface ReferenceCheck {
  id: number
  applicationId: number
  contactName: string
  relationship: string
  result: ReferenceCheckResult
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Onboarding {
  id: number
  applicationId: number
  userId: number | null
  otpCode: string
  otpExpiresAt: string
  emailVerifiedAt: string | null
  mfaRegisteredAt: string | null
  completedAt: string | null
  createdAt: string
  user: { id: number; username: string; email: string } | null
}

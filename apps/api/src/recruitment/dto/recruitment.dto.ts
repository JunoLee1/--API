import type {
  JobPostingStatus,
  JobApplicationStatus,
  InterviewRound,
  InterviewResult,
  ReferenceCheckResult,
} from "../../generated/enums";

export interface CreateJobPostingDto {
  title: string;
  departmentId?: number;
  headcount?: number;
  description: string;
}

export interface UpdateJobPostingDto {
  title?: string;
  departmentId?: number;
  headcount?: number;
  description?: string;
}

export interface JobPostingListQuery {
  status?: JobPostingStatus;
}

export interface CreateJobApplicationDto {
  applicantName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
}

export interface UpdateJobApplicationDto {
  applicantName?: string;
  email?: string;
  phone?: string;
  resumeUrl?: string;
  status?: "SCREENING";
}

export interface CreateInterviewDto {
  round: InterviewRound;
  scheduledAt?: string;
  interviewerIds?: number[];
}

export interface UpdateInterviewDto {
  scheduledAt?: string;
  interviewerIds?: number[];
  scoreSkill?: number;
  scoreComm?: number;
  scoreCulture?: number;
  comment?: string;
  result?: InterviewResult;
}

export interface CreateReferenceCheckDto {
  contactName: string;
  relationship: string;
  notes?: string;
}

export interface UpdateReferenceCheckDto {
  result?: ReferenceCheckResult;
  notes?: string;
}

export interface VerifyOtpDto {
  otp: string;
}

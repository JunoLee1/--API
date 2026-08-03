export interface NormalizedApplication {
  externalJobId: string;
  externalApplicantId: string;
  applicantName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
}

export interface WebhookAdapter {
  normalize(payload: unknown): NormalizedApplication;
}

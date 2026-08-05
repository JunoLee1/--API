export interface CreateSoftwareLicenseDto {
  name: string;
  vendor: string;
  totalSeats: number;
  expiresAt?: string;
  renewalCost?: number;
}

export interface UpdateSoftwareLicenseDto {
  name?: string;
  vendor?: string;
  totalSeats?: number;
  expiresAt?: string;
  renewalCost?: number;
}

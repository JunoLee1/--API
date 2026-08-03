export interface CreateAllowanceDto {
  name: string;
  amount: number;
  taxable?: boolean;
}

export interface UpdateAllowanceDto {
  name?: string;
  amount?: number;
  taxable?: boolean;
}

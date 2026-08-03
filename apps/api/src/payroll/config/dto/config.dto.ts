import type { PayrollCountry } from "../../../generated/enums";

export interface CreatePayrollConfigDto {
  country: PayrollCountry;
  insuranceType: string;
  employeeRate: number;
  employerRate: number;
  effectiveFrom: string;
}

export interface UpdatePayrollConfigDto {
  employeeRate?: number;
  employerRate?: number;
}

export interface PayrollConfigListQuery {
  country?: PayrollCountry;
}

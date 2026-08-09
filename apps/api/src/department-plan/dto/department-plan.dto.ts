export interface CreateDepartmentPlanDto {
  seasonId: number;
  departmentId: number;
  objectives?: string[];
  milestones?: { quarter: 1 | 2 | 3 | 4; text: string }[];
  budgetItems?: { category: string; amount: number }[];
  kpiItems?: { title: string; targetValue: string; quarter?: number | null }[];
}

export interface UpdateDepartmentPlanDto {
  objectives?: string[];
  milestones?: { quarter: 1 | 2 | 3 | 4; text: string }[];
  budgetItems?: { category: string; amount: number }[];
  kpiItems?: { title: string; targetValue: string; quarter?: number | null }[];
}

export interface RejectPlanDto {
  reason: string;
}

export interface ListDepartmentPlanQuery {
  seasonId?: number;
  departmentId?: number;
  status?: string;
}

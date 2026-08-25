export interface RequestNormalMedicalLoanDto {
  equipmentItemId: number;
  equipmentUnitId?: number;
  notes?: string;
  originalCost: number;
  overrideDiscountRate?: number;
  overrideReason?: string;
  budgetLineId: number;
  seasonId: number;
  categoryId: number;
}

export interface RequestEmergencyMedicalLoanDto {
  equipmentItemId: number;
  equipmentUnitId?: number;
  notes?: string;
  emergencyReason: string;
  originalCost: number;
  overrideDiscountRate?: number;
  overrideReason?: string;
}

export interface ApproveMedicalLoanDto {
  budgetLineId?: number;
  seasonId?: number;
  categoryId?: number;
}

export interface RejectMedicalLoanDto {
  rejectionReason: string;
}

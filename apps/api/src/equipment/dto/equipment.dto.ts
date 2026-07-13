import { EquipmentCategory, EquipmentUnitStatus } from "../../generated/enums";

export interface CreateEquipmentItemDto {
  name: string;
  category: EquipmentCategory;
  trackedIndividually: boolean;
  quantity?: number;
  lowStockThreshold?: number;
}

export interface UpdateQuantityDto {
  delta: number;
}

export interface UpdateUnitStatusDto {
  status: EquipmentUnitStatus;
}

export interface CreateAssignmentDto {
  playerId: string;
  equipmentItemId?: number;
  equipmentUnitId?: number;
}

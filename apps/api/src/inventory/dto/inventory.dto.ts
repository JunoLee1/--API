export interface CreateInventoryItemDto {
  name: string;
  unit: string;
  quantity?: number;
  minThreshold?: number;
}

export interface AdjustQuantityDto {
  delta: number;
}

export interface CreateSalesRecordDto {
  type: "TICKET" | "UNIFORM" | "OTHER";
  quantity: number;
  unitPrice: number;
  currency?: "KRW" | "USD" | "EUR" | "GBP";
  saleDate: string;
  description?: string;
  matchId?: number;
}

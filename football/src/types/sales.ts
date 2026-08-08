export type SalesType = 'TICKET' | 'UNIFORM' | 'OTHER' | 'VIP_TICKET' | 'COMPLIMENTARY'

export interface SalesRecord {
  id: number
  type: SalesType
  quantity: number
  unitPrice: number
  totalAmount: number
  currency: string
  saleDate: string
  description: string | null
  matchId: number | null
  seatZoneId?: number
  createdById: number
  createdAt: string
  match: {
    id: number
    homeTeamName: string
    awayTeamName: string
    date: string
  } | null
}

export interface TicketMatchSummary {
  matchId: number
  date: string
  homeTeamName: string
  awayTeamName: string
  totalQuantity: number
  totalAmount: number
}

export interface CreateSalesRecordDto {
  type: SalesType
  quantity: number
  unitPrice: number
  currency?: string
  saleDate: string
  description?: string
  matchId?: number
  seatZoneId?: number
}

export interface AccountCode {
  id: number
  code: string
  name: string
  type: 'REVENUE' | 'EXPENSE'
  createdAt: string
}

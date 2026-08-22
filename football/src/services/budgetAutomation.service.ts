import { api } from './api'
import type { BudgetPreviewRequest, BudgetPreviewResponse, BudgetApplyRequest } from '@/types/budget-automation'
import type { BudgetHeader } from '@/types/budget-control'

export const budgetAutomationApi = {
  preview: (data: BudgetPreviewRequest) =>
    api.post<BudgetPreviewResponse>('/budget-automation/preview', data),
  apply: (data: BudgetApplyRequest) =>
    api.post<BudgetHeader>('/budget-automation/apply', data),
}

import { api } from './api'
import type { ExpenseCategory } from '@/types/expense-category'

export const expenseCategoryApi = {
  list: () => api.get<ExpenseCategory[]>('/expense-categories'),
}

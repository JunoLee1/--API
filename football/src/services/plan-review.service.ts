import { api } from './api'
import type { PlanReview, DepartmentReviewerConfig } from '@/types/department-plan'

export const planReviewApi = {
  list: (planId: number) =>
    api.get<PlanReview[]>(`/plan-reviews/${planId}`),
  confirm: (planId: number, comment?: string) =>
    api.post<PlanReview>(`/plan-reviews/${planId}/confirm`, { comment }),
}

export const reviewerConfigApi = {
  list: (subjectDepartmentId: number) =>
    api.get<DepartmentReviewerConfig[]>(`/department-review-configs?subjectDepartmentId=${subjectDepartmentId}`),
  create: (data: { subjectDepartmentId: number; reviewerDepartmentId: number }) =>
    api.post<DepartmentReviewerConfig>(`/department-review-configs`, data),
  delete: (id: number) =>
    api.delete(`/department-review-configs/${id}`),
}

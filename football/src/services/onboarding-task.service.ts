import { api } from './api'
import type {
  OnboardingTask,
  OnboardingVerifyQueueRow,
  SkipOnboardingTaskPayload,
  VerifyOnboardingTaskPayload,
} from '@/types/onboarding-task'

/**
 * Client for `/api/onboarding-tasks`. Mirrors
 * `apps/api/src/onboarding-task/onboarding-task.routes.ts` 1:1.
 *
 * Errors: shared `request()` in ./api throws Error(code) — pages catch and
 * map (e.g. NOT_TASK_OWNER → "본인 태스크만 완료할 수 있습니다").
 */
export const onboardingTaskApi = {
  listByOnboardingId(onboardingId: number) {
    return api.get<OnboardingTask[]>(`/onboarding-tasks/onboarding/${onboardingId}`)
  },

  verifyQueue(filter?: { departmentId?: number }) {
    const params = new URLSearchParams()
    if (filter?.departmentId != null) params.set('departmentId', String(filter.departmentId))
    const qs = params.toString()
    return api.get<OnboardingVerifyQueueRow[]>(
      `/onboarding-tasks/verify-queue${qs ? `?${qs}` : ''}`,
    )
  },

  selfReport(taskId: number) {
    return api.patch<OnboardingTask>(`/onboarding-tasks/${taskId}/self-report`, {})
  },

  verify(taskId: number, payload: VerifyOnboardingTaskPayload) {
    return api.patch<OnboardingTask>(`/onboarding-tasks/${taskId}/verify`, payload)
  },

  skip(taskId: number, payload: SkipOnboardingTaskPayload) {
    return api.patch<OnboardingTask>(`/onboarding-tasks/${taskId}/skip`, payload)
  },
}

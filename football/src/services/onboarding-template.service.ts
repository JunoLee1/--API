import { api } from './api'
import type {
  OnboardingTemplate,
  UpsertOnboardingTemplatePayload,
} from '@/types/onboarding-template'

/**
 * Client for `/api/onboarding-templates`. Mirrors
 * `apps/api/src/onboarding-template/onboarding-template.routes.ts` 1:1.
 *
 * Errors: the shared `request()` in ./api throws Error(code) with the backend
 * error code (e.g. TEMPLATE_NOT_FOUND, TASK_TITLE_REQUIRED_AT:0). Pages catch
 * and map codes to Korean UI strings.
 */
export const onboardingTemplateApi = {
  get(departmentId: number) {
    return api.get<OnboardingTemplate>(`/onboarding-templates/${departmentId}`)
  },

  upsert(departmentId: number, payload: UpsertOnboardingTemplatePayload) {
    return api.put<OnboardingTemplate>(`/onboarding-templates/${departmentId}`, payload)
  },

  remove(departmentId: number) {
    return api.delete<OnboardingTemplate>(`/onboarding-templates/${departmentId}`)
  },
}

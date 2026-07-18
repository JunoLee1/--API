import api from "./api";
import type {
  DevelopmentPlan,
  CreateDevelopmentPlanPayload,
  UpdateDevelopmentPlanPayload,
} from "../types/development-plan";

export const developmentPlanApi = {
  list(params?: { playerId?: string; seasonId?: number }) {
    return api
      .get<DevelopmentPlan[]>("/development-plans", { params })
      .then((r) => r.data);
  },

  get(id: number) {
    return api.get<DevelopmentPlan>(`/development-plans/${id}`).then((r) => r.data);
  },

  create(payload: CreateDevelopmentPlanPayload) {
    return api.post<DevelopmentPlan>("/development-plans", payload).then((r) => r.data);
  },

  update(id: number, payload: UpdateDevelopmentPlanPayload) {
    return api.put<DevelopmentPlan>(`/development-plans/${id}`, payload).then((r) => r.data);
  },

  activate(id: number) {
    return api.patch<DevelopmentPlan>(`/development-plans/${id}/activate`).then((r) => r.data);
  },

  review(id: number) {
    return api.patch<DevelopmentPlan>(`/development-plans/${id}/review`).then((r) => r.data);
  },
};

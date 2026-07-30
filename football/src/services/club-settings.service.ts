import { api } from "./api";

export interface ClubSettings {
  id: number;
  currency: string;
}

export const clubSettingsApi = {
  get: (): Promise<ClubSettings> => api.get("/club-settings"),
  update: (currency: string): Promise<ClubSettings> =>
    api.patch("/club-settings", { currency }),
};

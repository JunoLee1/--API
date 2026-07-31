import { api } from "./api";

export interface Department {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const departmentApi = {
  list: (): Promise<Department[]> => api.get("/departments"),
  get: (id: number): Promise<Department> => api.get(`/departments/${id}`),
  create: (data: { name: string }): Promise<Department> => api.post("/departments", data),
  update: (id: number, data: { name?: string; isActive?: boolean }): Promise<Department> =>
    api.patch(`/departments/${id}`, data),
  delete: (id: number): Promise<void> => api.delete(`/departments/${id}`),
};

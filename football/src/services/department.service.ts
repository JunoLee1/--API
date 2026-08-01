import { api } from "./api";

export interface Department {
  id: number;
  name: string;
  parentId: number | null;
  parent: Pick<Department, 'id' | 'name'> | null;
  children: Pick<Department, 'id' | 'name' | 'isActive'>[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const departmentApi = {
  list: (): Promise<Department[]> => api.get("/departments"),
  get: (id: number): Promise<Department> => api.get(`/departments/${id}`),
  create: (data: { name: string; parentId?: number }): Promise<Department> =>
    api.post("/departments", data),
  update: (
    id: number,
    data: { name?: string; isActive?: boolean; parentId?: number | null }
  ): Promise<Department> => api.patch(`/departments/${id}`, data),
  delete: (id: number): Promise<void> => api.delete(`/departments/${id}`),
};

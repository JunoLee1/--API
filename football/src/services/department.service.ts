import { api } from "./api";

export interface Department {
  id: number;
  name: string;
  parentId: number | null;
  headId: number | null;
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

export type DeptRole = "LEADER" | "DEPUTY" | "MANAGER" | "SENIOR" | "MEMBER" | "INTERN";

export interface Member {
  userId: number;
  departmentId: number;
  role: DeptRole;
  joinedAt: string;
  user: { id: number; name: string; email: string; role: string };
}

export const departmentMemberApi = {
  list: (deptId: number): Promise<Member[]> => api.get(`/departments/${deptId}/members`),
  add: (deptId: number, userId: number, role?: DeptRole): Promise<void> =>
    api.post(`/departments/${deptId}/members`, { userId, ...(role && { role }) }),
  updateRole: (deptId: number, userId: number, role: DeptRole): Promise<void> =>
    api.patch(`/departments/${deptId}/members/${userId}`, { role }),
  remove: (deptId: number, userId: number): Promise<void> =>
    api.delete(`/departments/${deptId}/members/${userId}`),
  transfer: (deptId: number, userId: number, toDeptId: number, toRole?: DeptRole): Promise<void> =>
    api.post(`/departments/${deptId}/members/${userId}/transfer`, { toDeptId, ...(toRole && { toRole }) }),
  updateHead: (deptId: number, newHeadId: number | null): Promise<void> =>
    api.patch(`/departments/${deptId}/head`, { newHeadId }),
};

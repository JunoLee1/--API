import { PrismaClient } from "../generated/client";
import type { DepartmentCategory, DeptRole } from "../generated/enums";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class DepartmentRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(clubId?: number | null) {
    return this.prisma.department.findMany({
      where: { parentId: null, ...(clubId != null && { clubId }) },
      orderBy: { name: "asc" },
      include: { children: { orderBy: { name: "asc" } } },
    });
  }

  findById(id: number) {
    return this.prisma.department.findUnique({
      where: { id },
      include: { children: { orderBy: { name: "asc" } }, parent: true },
    });
  }

  findByName(name: string, clubId?: number | null) {
    return this.prisma.department.findUnique({
      where: { name_clubId: { name, clubId: clubId ?? (null as unknown as number) } },
    });
  }

  create(data: { name: string; parentId?: number; category?: DepartmentCategory | null; clubId?: number | null }) {
    return this.prisma.department.create({
      data,
      include: { children: { orderBy: { name: "asc" } }, parent: true },
    });
  }

  update(id: number, data: { name?: string; isActive?: boolean; parentId?: number | null; category?: DepartmentCategory | null }) {
    return this.prisma.department.update({
      where: { id },
      data,
      include: { children: { orderBy: { name: "asc" } }, parent: true },
    });
  }

  countActiveStaff(departmentId: number) {
    return this.prisma.staffRecord.count({ where: { departmentId, isActive: true } });
  }

  async getHeadcount(departmentId: number) {
    const [activeStaff, totalStaff] = await Promise.all([
      this.prisma.staffRecord.count({ where: { departmentId, isActive: true } }),
      this.prisma.staffRecord.count({ where: { departmentId } }),
    ]);
    return { activeStaff, totalStaff, inactive: totalStaff - activeStaff };
  }

  delete(id: number) {
    return this.prisma.department.delete({ where: { id } });
  }

  // ── Member CRUD ────────────────────────────────────────────

  findMembers(deptId: number) {
    return this.prisma.userDepartment.findMany({
      where: { departmentId: deptId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });
  }

  findMember(deptId: number, userId: number) {
    return this.prisma.userDepartment.findUnique({
      where: { userId_departmentId: { userId, departmentId: deptId } },
    });
  }

  findUserById(userId: number) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  addMember(deptId: number, userId: number, role: DeptRole, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.userDepartment.create({
      data: { departmentId: deptId, userId, role },
    });
  }

  updateMemberRole(deptId: number, userId: number, role: DeptRole, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.userDepartment.update({
      where: { userId_departmentId: { userId, departmentId: deptId } },
      data: { role },
    });
  }

  removeMember(deptId: number, userId: number, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.userDepartment.delete({
      where: { userId_departmentId: { userId, departmentId: deptId } },
    });
  }

  transferMember(fromDeptId: number, toDeptId: number, userId: number, toRole: DeptRole) {
    return this.prisma.$transaction(async (tx) => {
      await tx.userDepartment.delete({
        where: { userId_departmentId: { userId, departmentId: fromDeptId } },
      });
      await tx.userDepartment.create({
        data: { departmentId: toDeptId, userId, role: toRole },
      });
    });
  }

  countUserDepartments(userId: number) {
    return this.prisma.userDepartment.count({ where: { userId } });
  }

  updateHead(deptId: number, newHeadId: number | null, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.department.update({
      where: { id: deptId },
      data: { headId: newHeadId },
    });
  }
}

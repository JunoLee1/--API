import { PrismaClient } from "../generated/client";
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";
import { ListUsersQuery } from "./dto/admin.dto";

export const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  nickname: true,
  role: true,
  coachingRole: true,
  frontOfficeRole: true,
  isDeleted: true,
  isOutOfOffice: true,
  player: { select: { id: true, playerName: true } },
} as const;

const LINKED_COUNT_SELECT = {
  _count: {
    select: {
      managedContracts: true,
      createdSessions: true,
      approvedSessions: true,
      tacticalAnalyses: true,
      managedInjuries: true,
      agentPlayers: true,
      recallRequests: true,
      recallApprovals: true,
    },
  },
  player: { select: { id: true } },
} as const;

export class AdminRepository {
  constructor(private prisma: PrismaClient) {}

  listUsers(filters: ListUsersQuery) {
    return this.prisma.user.findMany({
      where: {
        ...(filters.username && {
          username: { contains: filters.username, mode: "insensitive" },
        }),
        ...(filters.role && { role: filters.role }),
        ...(filters.coachingRole && { coachingRole: filters.coachingRole }),
        ...(filters.frontOfficeRole && { frontOfficeRole: filters.frontOfficeRole }),
        ...(filters.isDeleted !== undefined && { isDeleted: filters.isDeleted }),
      },
      select: USER_SELECT,
      orderBy: { id: "asc" },
    });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  }

  updateRole(
    id: number,
    role: Role,
    coachingRole: CoachingRole | null,
    frontOfficeRole: FrontOfficeRole | null,
  ) {
    return this.prisma.user.update({
      where: { id },
      data: { role, coachingRole, frontOfficeRole },
      select: USER_SELECT,
    });
  }

  setDeleted(id: number, isDeleted: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isDeleted },
      select: USER_SELECT,
    });
  }

  getLinkedData(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: LINKED_COUNT_SELECT,
    });
  }

  async hardDelete(id: number): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  findPlayersWithoutAccounts(nameFilter?: string) {
    return this.prisma.player.findMany({
      where: {
        userId: null,
        ...(nameFilter && {
          playerName: { contains: nameFilter, mode: "insensitive" },
        }),
      },
      select: { id: true, playerName: true, status: true, position: true },
      orderBy: { playerName: "asc" },
    });
  }
}

import { PrismaClient } from "../generated/client";

export interface CreateTeamDto {
  name: string;
  type: "FIRST_TEAM" | "YOUTH";
  ageGroup?: string;
  trackStats?: boolean;
  requiresContract?: boolean;
}

export interface UpdateTeamDto {
  name?: string;
  ageGroup?: string;
  trackStats?: boolean;
  requiresContract?: boolean;
  isActive?: boolean;
}

export class TeamRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.team.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  }

  findById(id: number) {
    return this.prisma.team.findUnique({ where: { id } });
  }

  create(dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        type: dto.type,
        ageGroup: dto.ageGroup ?? null,
        trackStats: dto.trackStats ?? true,
        requiresContract: dto.requiresContract ?? true,
      },
    });
  }

  update(id: number, dto: UpdateTeamDto) {
    return this.prisma.team.update({ where: { id }, data: dto });
  }
}

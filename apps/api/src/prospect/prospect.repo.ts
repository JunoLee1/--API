import { PrismaClient } from "../generated/client";
import { ProspectStatus } from "../generated/enums";
import { CreateProspectDto, UpdateProspectDto } from "./dto/prospect.dto";

const PROSPECT_SELECT = {
  id: true,
  name: true,
  nationality: true,
  position: true,
  currentTeam: true,
  notes: true,
  status: true,
  convertedPlayerId: true,
  createdAt: true,
  createdBy: { select: { nickname: true } },
} as const;

export class ProspectRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(status?: ProspectStatus) {
    return this.prisma.prospect.findMany({
      ...(status !== undefined && { where: { status } }),
      select: PROSPECT_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.prospect.findUnique({ where: { id }, select: PROSPECT_SELECT });
  }

  create(dto: CreateProspectDto) {
    return this.prisma.prospect.create({
      data: {
        name: dto.name,
        nationality: dto.nationality ?? null,
        position: dto.position ?? null,
        currentTeam: dto.currentTeam ?? null,
        notes: dto.notes ?? null,
        createdById: dto.createdById ?? null,
      },
      select: PROSPECT_SELECT,
    });
  }

  update(id: number, dto: UpdateProspectDto) {
    return this.prisma.prospect.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.currentTeam !== undefined && { currentTeam: dto.currentTeam }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: PROSPECT_SELECT,
    });
  }

  updateStatus(id: number, status: ProspectStatus, convertedPlayerId?: string) {
    return this.prisma.prospect.update({
      where: { id },
      data: { status, convertedPlayerId: convertedPlayerId ?? null },
      select: PROSPECT_SELECT,
    });
  }
}

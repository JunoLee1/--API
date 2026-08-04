import { PrismaClient } from "../generated/client";
import { CreateClubDto, UpdateClubDto } from "./club.dto";

const CLUB_SELECT = {
  id: true,
  name: true,
  isActive: true,
  isLite: true,
  createdAt: true,
  teams: { select: { id: true, name: true, type: true, isActive: true } },
} as const;

export class ClubRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.club.findMany({ select: CLUB_SELECT, orderBy: { name: "asc" } });
  }

  findById(id: number) {
    return this.prisma.club.findUnique({ where: { id }, select: CLUB_SELECT });
  }

  findByIds(ids: number[]) {
    return this.prisma.club.findMany({ where: { id: { in: ids } }, select: CLUB_SELECT });
  }

  create(dto: CreateClubDto) {
    return this.prisma.club.create({ data: { name: dto.name }, select: CLUB_SELECT });
  }

  update(id: number, dto: UpdateClubDto) {
    return this.prisma.club.update({ where: { id }, data: dto, select: CLUB_SELECT });
  }
}

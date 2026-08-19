import type { PrismaClient } from "../../generated/client";
import type { CreatePreventiveScheduleDto, UpdatePreventiveScheduleDto, PreventiveScheduleListQuery } from "./dto/preventive-schedule.dto";

const INCLUDE = {
  partner: { select: { id: true, name: true, type: true } },
} as const;

export class PreventiveScheduleRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: PreventiveScheduleListQuery) {
    return this.prisma.preventiveSchedule.findMany({
      where: {
        ...(query.facilityZone && { facilityZone: query.facilityZone as any }),
        ...(query.isActive !== undefined && { isActive: query.isActive === "true" }),
      },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.preventiveSchedule.findUnique({ where: { id }, include: INCLUDE });
  }

  create(dto: CreatePreventiveScheduleDto) {
    return this.prisma.preventiveSchedule.create({
      data: {
        facilityZone: dto.facilityZone as any,
        title: dto.title,
        intervalDays: dto.intervalDays,
        priority: dto.priority as any,
        ...(dto.description && { description: dto.description }),
        ...(dto.partnerId && { partnerId: dto.partnerId }),
      },
      include: INCLUDE,
    });
  }

  update(id: number, dto: UpdatePreventiveScheduleDto) {
    return this.prisma.preventiveSchedule.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.intervalDays !== undefined && { intervalDays: dto.intervalDays }),
        ...(dto.priority !== undefined && { priority: dto.priority as any }),
        ...(dto.partnerId !== undefined && { partnerId: dto.partnerId }),
      },
      include: INCLUDE,
    });
  }

  deactivate(id: number) {
    return this.prisma.preventiveSchedule.update({
      where: { id },
      data: { isActive: false },
      include: INCLUDE,
    });
  }

  findAllActive() {
    return this.prisma.preventiveSchedule.findMany({
      where: { isActive: true },
      include: INCLUDE,
    });
  }

  updateLastGeneratedAt(id: number, date: Date) {
    return this.prisma.preventiveSchedule.update({
      where: { id },
      data: { lastGeneratedAt: date },
    });
  }
}

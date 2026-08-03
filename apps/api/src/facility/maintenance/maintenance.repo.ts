import type { PrismaClient } from "../../generated/client";
import type { CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceListQuery } from "./dto/maintenance.dto";

const INCLUDE = {
  createdBy: { select: { id: true, username: true } },
  sourceInspection: { select: { id: true, type: true, facilityZone: true } },
} as const;

export class MaintenanceRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: MaintenanceListQuery) {
    return this.prisma.maintenanceRequest.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.priority && { priority: query.priority }),
      },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.maintenanceRequest.findUnique({ where: { id }, include: INCLUDE });
  }

  create(data: CreateMaintenanceDto & { createdById: number }) {
    return this.prisma.maintenanceRequest.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        createdById: data.createdById,
        ...(data.sourceInspectionId && { sourceInspectionId: data.sourceInspectionId }),
        ...(data.estimatedCost !== undefined && { estimatedCost: data.estimatedCost }),
      },
      include: INCLUDE,
    });
  }

  update(id: number, data: UpdateMaintenanceDto & { resolvedAt?: Date }) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...data,
        ...(data.estimatedCost !== undefined && { estimatedCost: data.estimatedCost }),
        ...(data.actualCost !== undefined && { actualCost: data.actualCost }),
      },
      include: INCLUDE,
    });
  }
}

import { PrismaClient } from "../generated/client";
import { EquipmentUnitStatus } from "../generated/enums";
import { CreateEquipmentItemDto, CreateAssignmentDto } from "./dto/equipment.dto";

const ITEM_SELECT = {
  id: true,
  name: true,
  category: true,
  trackedIndividually: true,
  quantity: true,
  lowStockThreshold: true,
} as const;

const UNIT_SELECT = {
  id: true,
  status: true,
  equipmentItemId: true,
} as const;

const ASSIGNMENT_SELECT = {
  id: true,
  issuedAt: true,
  returnedAt: true,
  playerId: true,
  equipmentItemId: true,
  equipmentUnitId: true,
} as const;

export class EquipmentRepository {
  constructor(private prisma: PrismaClient) {}

  findAllItems() {
    return this.prisma.equipmentItem.findMany({ select: ITEM_SELECT });
  }

  findItemById(id: number) {
    return this.prisma.equipmentItem.findUnique({
      where: { id },
      select: {
        ...ITEM_SELECT,
        units: { select: UNIT_SELECT },
        assignments: { select: ASSIGNMENT_SELECT, where: { returnedAt: null } },
      },
    });
  }

  createItem(dto: CreateEquipmentItemDto) {
    return this.prisma.equipmentItem.create({
      data: {
        name: dto.name,
        category: dto.category,
        trackedIndividually: dto.trackedIndividually,
        quantity: dto.quantity ?? null,
        lowStockThreshold: dto.lowStockThreshold ?? null,
      },
      select: ITEM_SELECT,
    });
  }

  adjustQuantity(id: number, delta: number) {
    return this.prisma.equipmentItem.update({
      where: { id },
      data: { quantity: { increment: delta } },
      select: ITEM_SELECT,
    });
  }

  createUnit(equipmentItemId: number) {
    return this.prisma.equipmentUnit.create({
      data: { equipmentItemId },
      select: UNIT_SELECT,
    });
  }

  findUnitById(id: number) {
    return this.prisma.equipmentUnit.findUnique({ where: { id }, select: UNIT_SELECT });
  }

  updateUnitStatus(id: number, status: EquipmentUnitStatus) {
    return this.prisma.equipmentUnit.update({
      where: { id },
      data: { status },
      select: UNIT_SELECT,
    });
  }

  createAssignment(dto: CreateAssignmentDto) {
    return this.prisma.equipmentAssignment.create({
      data: {
        playerId: dto.playerId,
        equipmentItemId: dto.equipmentItemId ?? null,
        equipmentUnitId: dto.equipmentUnitId ?? null,
      },
      select: ASSIGNMENT_SELECT,
    });
  }

  findUnreturnedByPlayer(playerId: string) {
    return this.prisma.equipmentAssignment.findMany({
      where: { playerId, returnedAt: null },
      select: ASSIGNMENT_SELECT,
    });
  }

  findAssignmentById(id: number) {
    return this.prisma.equipmentAssignment.findUnique({ where: { id }, select: ASSIGNMENT_SELECT });
  }

  markReturned(id: number) {
    return this.prisma.equipmentAssignment.update({
      where: { id },
      data: { returnedAt: new Date() },
      select: ASSIGNMENT_SELECT,
    });
  }

  findEquipmentManagers() {
    return this.prisma.user.findMany({
      where: { frontOfficeRole: "EQUIPMENT_MANAGER", isDeleted: false },
      select: { id: true },
    });
  }
}

import { PrismaClient } from "../generated/client";
import { EquipmentUnitStatus, EquipmentLoanStatus } from "../generated/enums";
import { CreateEquipmentItemDto, CreateAssignmentDto, CreateEquipmentLoanDto, CreateEquipmentUnitDto } from "./dto/equipment.dto";

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
  serialNumber: true,
  lastInspectedAt: true,
  inspectionIntervalDays: true,
  nextInspectionDue: true,
  lastSanitizedAt: true,
  sanitationStatus: true,
  assignments: {
    where: { returnedAt: null },
    take: 1,
    select: { player: { select: { name: true } } },
  },
} as any;

const ASSIGNMENT_SELECT = {
  id: true,
  issuedAt: true,
  returnedAt: true,
  playerId: true,
  equipmentItemId: true,
  equipmentUnitId: true,
} as const;

const LOAN_SELECT = {
  id: true, status: true, requestedAt: true, issuedAt: true, returnedAt: true,
  notes: true, equipmentItemId: true, equipmentUnitId: true,
  requestedBy: { select: { id: true, nickname: true } },
  approvedBy: { select: { id: true, nickname: true } },
  equipmentItem: { select: { id: true, name: true, category: true } },
  equipmentUnit: { select: { id: true } },
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

  createUnit(equipmentItemId: number, dto?: CreateEquipmentUnitDto) {
    return this.prisma.equipmentUnit.create({
      data: {
        equipmentItemId,
        ...(dto?.serialNumber && { serialNumber: dto.serialNumber }),
        ...(dto?.purchasedAt && { purchasedAt: dto.purchasedAt }),
        ...(dto?.purchaseValue !== undefined && { purchaseValue: dto.purchaseValue, bookValue: dto.purchaseValue }),
        ...(dto?.depreciationRate !== undefined && { depreciationRate: dto.depreciationRate }),
        ...(dto?.depreciationMethod && { depreciationMethod: dto.depreciationMethod }),
        ...(dto?.isHighValue !== undefined && { isHighValue: dto.isHighValue }),
      },
      select: UNIT_SELECT,
    });
  }

  updateUnitDepreciation(unitId: number, bookValue: number) {
    return this.prisma.equipmentUnit.update({
      where: { id: unitId },
      data: { bookValue },
    });
  }

  findUnitWithDepreciation(unitId: number) {
    return this.prisma.equipmentUnit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        purchaseValue: true,
        bookValue: true,
        depreciationRate: true,
        depreciationMethod: true,
        purchasedAt: true,
      },
    });
  }

  findUnitById(id: number) {
    return this.prisma.equipmentUnit.findUnique({ where: { id }, select: UNIT_SELECT });
  }

  updateUnitStatus(id: number, status: EquipmentUnitStatus, disposalData?: { disposedById?: number; disposedAt?: Date; disposalNote?: string }) {
    return this.prisma.equipmentUnit.update({
      where: { id },
      data: {
        status,
        ...(disposalData?.disposedById !== undefined && { disposedById: disposalData.disposedById }),
        ...(disposalData?.disposedAt !== undefined && { disposedAt: disposalData.disposedAt }),
        ...(disposalData?.disposalNote !== undefined && { disposalNote: disposalData.disposalNote }),
      },
      select: UNIT_SELECT,
    });
  }

  updateUnit(id: number, data: {
    lastSanitizedAt?: Date;
    sanitationStatus?: string;
    lastInspectedAt?: Date;
    inspectionIntervalDays?: number;
    nextInspectionDue?: Date;
  }) {
    return this.prisma.equipmentUnit.update({
      where: { id },
      data,
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

  findLoanById(id: number) {
    return this.prisma.equipmentLoan.findUnique({ where: { id }, select: LOAN_SELECT });
  }

  findAllLoans(status?: EquipmentLoanStatus) {
    return this.prisma.equipmentLoan.findMany({
      ...(status !== undefined && { where: { status } }),
      select: LOAN_SELECT,
      orderBy: { requestedAt: "desc" },
    });
  }

  findMyLoans(userId: number) {
    return this.prisma.equipmentLoan.findMany({
      where: { requestedById: userId },
      select: LOAN_SELECT,
      orderBy: { requestedAt: "desc" },
    });
  }

  createLoan(requestedById: number, dto: CreateEquipmentLoanDto) {
    return this.prisma.equipmentLoan.create({
      data: {
        requestedById,
        equipmentItemId: dto.equipmentItemId,
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: LOAN_SELECT,
    });
  }

  updateLoan(id: number, data: {
    status: EquipmentLoanStatus;
    approvedById?: number;
    equipmentUnitId?: number;
    issuedAt?: Date;
    returnedAt?: Date;
  }) {
    return this.prisma.equipmentLoan.update({
      where: { id },
      data,
      select: LOAN_SELECT,
    });
  }

  returnLoan(id: number, returnedById: number, returnNote?: string) {
    return this.prisma.equipmentLoan.update({
      where: { id },
      data: {
        status: "RETURNED" as EquipmentLoanStatus,
        returnedAt: new Date(),
        returnedById,
        ...(returnNote && { returnNote }) as any,
      },
      select: LOAN_SELECT,
    });
  }
}

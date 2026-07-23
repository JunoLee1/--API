import { PrismaClient } from "../generated/client";

export class NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  findByUserId(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  markRead(id: number, userId: number) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  create(data: { userId: number; type: string; title: string; body: string; entityId?: number }) {
    return this.prisma.notification.create({ data: data as any });
  }

  createForStaff(type: string, title: string, body: string, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const staffUsers = await tx.user.findMany({
        where: { role: { in: ["ADMIN", "FRONT_OFFICE"] } },
        select: { id: true },
      });
      await tx.notification.createMany({
        data: staffUsers.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
      });
    });
  }

  createForGM(type: string, title: string, body: string, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const gmUsers = await tx.user.findMany({
        where: { role: "FRONT_OFFICE", frontOfficeRole: "GM" },
        select: { id: true },
      });
      if (gmUsers.length === 0) return;
      await tx.notification.createMany({
        data: gmUsers.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
      });
    });
  }

  createForMedicalDirector(type: string, title: string, body: string, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const directors = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR" },
        select: { id: true },
      });
      if (directors.length === 0) return;
      await tx.notification.createMany({
        data: directors.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
      });
    });
  }

  createForAdmin(type: string, title: string, body: string, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const admins = await tx.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      if (admins.length === 0) return;
      await tx.notification.createMany({
        data: admins.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
      });
    });
  }

  createForTD(type: string, title: string, body: string, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const tdUsers = await tx.user.findMany({
        where: { role: "FRONT_OFFICE", frontOfficeRole: "TD" },
        select: { id: true },
      });
      if (tdUsers.length === 0) return;
      await tx.notification.createMany({
        data: tdUsers.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
      });
    });
  }

  createForHeadCoach(type: string, title: string, body: string, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const headCoaches = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" },
        select: { id: true },
      });
      if (headCoaches.length === 0) return;
      await tx.notification.createMany({
        data: headCoaches.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
      });
    });
  }

  createForCoachingStaff(type: string, title: string, body: string, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const coaches = await tx.user.findMany({
        where: { role: "COACHING_STAFF" },
        select: { id: true },
      });
      if (coaches.length === 0) return;
      await tx.notification.createMany({
        data: coaches.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
      });
    });
  }

  createForPhysicalCoach(type: string, title: string, body: string, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "PHYSICAL_COACH" },
        select: { id: true },
      });
      if (users.length === 0) return;
      await tx.notification.createMany({
        data: users.map((u) => ({ userId: u.id, type, title, body, entityId })) as any,
      });
    });
  }

  createForUser(userId: number, type: string, title: string, body: string, entityId?: number) {
    return this.prisma.notification.create({
      data: { userId, type, title, body, ...(entityId && { entityId }) } as any,
    });
  }

  createForGuardian(guardianUserId: number, type: string, title: string, body: string, entityId?: number) {
    return this.prisma.notification.create({
      data: { userId: guardianUserId, type, title, body, ...(entityId && { entityId }) } as any,
    });
  }

  findExpiringContracts(withinDays: number) {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + withinDays);
    return this.prisma.partnerContract.findMany({
      where: { status: "ACTIVE", endDate: { gte: now, lte: threshold } },
      select: {
        id: true, endDate: true, sponsorshipFee: true, discountRate: true,
        partner: { select: { id: true, name: true, type: true } },
      },
      orderBy: { endDate: "asc" },
    });
  }
}

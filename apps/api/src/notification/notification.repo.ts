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

  create(data: { userId: number; type: string; title: string; body: string }) {
    return this.prisma.notification.create({ data: data as any });
  }

  createForStaff(type: string, title: string, body: string) {
    return this.prisma.$transaction(async (tx) => {
      const staffUsers = await tx.user.findMany({
        where: { role: { in: ["ADMIN", "FRONT_OFFICE"] } },
        select: { id: true },
      });
      await tx.notification.createMany({
        data: staffUsers.map((u) => ({ userId: u.id, type, title, body })) as any,
      });
    });
  }

  findExpiringContracts(withinDays: number) {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + withinDays);
    return this.prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        endDate: { gte: now, lte: threshold },
      },
      select: {
        id: true,
        endDate: true,
        player: { select: { id: true, playerName: true } },
        managedBy: { select: { nickname: true } },
      },
      orderBy: { endDate: "asc" },
    });
  }
}

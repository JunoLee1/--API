import { PrismaClient } from "../generated/client";

type MsgFactory = (locale: string) => { title: string; body: string };

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

  createForStaff(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const staffUsers = await tx.user.findMany({
        where: { role: { in: ["ADMIN", "FRONT_OFFICE"] } },
        select: { id: true, language: true },
      });
      await tx.notification.createMany({
        data: staffUsers.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForGM(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const gmUsers = await tx.user.findMany({
        where: { role: "GM" },
        select: { id: true, language: true },
      });
      if (gmUsers.length === 0) return;
      await tx.notification.createMany({
        data: gmUsers.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForMedicalDirector(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const directors = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "MEDICAL_DIRECTOR" },
        select: { id: true, language: true },
      });
      if (directors.length === 0) return;
      await tx.notification.createMany({
        data: directors.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForAdmin(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const admins = await tx.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true, language: true },
      });
      if (admins.length === 0) return;
      await tx.notification.createMany({
        data: admins.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForHrManager(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const hrManagers = await tx.user.findMany({
        where: { role: 'FRONT_OFFICE', frontOfficeRole: 'HR_MANAGER', isDeleted: false },
        select: { id: true, language: true },
      })
      if (hrManagers.length === 0) return
      await tx.notification.createMany({
        data: hrManagers.map((u) => {
          const { title, body } = getMsg(u.language)
          return { userId: u.id, type, title, body, entityId }
        }) as any,
      })
    })
  }

  createForTD(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const tdUsers = await tx.user.findMany({
        where: { role: "FRONT_OFFICE", frontOfficeRole: "TD" },
        select: { id: true, language: true },
      });
      if (tdUsers.length === 0) return;
      await tx.notification.createMany({
        data: tdUsers.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForContractManager(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const contractManagers = await tx.user.findMany({
        where: { role: "FRONT_OFFICE", frontOfficeRole: "CONTRACT_MANAGER" },
        select: { id: true, language: true },
      });
      if (contractManagers.length === 0) return;
      await tx.notification.createMany({
        data: contractManagers.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForHeadCoach(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const headCoaches = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "HEAD_COACH" },
        select: { id: true, language: true },
      });
      if (headCoaches.length === 0) return;
      await tx.notification.createMany({
        data: headCoaches.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForYouthHeadCoach(fromTeamId: number, type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const coaches = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "HEAD_COACH", teamId: fromTeamId },
        select: { id: true, language: true },
      });
      if (coaches.length === 0) return;
      await tx.notification.createMany({
        data: coaches.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForMedicalStaff(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const medics = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "MEDICAL" },
        select: { id: true, language: true },
      });
      if (medics.length === 0) return;
      await tx.notification.createMany({
        data: medics.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForCoachingStaff(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const coaches = await tx.user.findMany({
        where: { role: "COACHING_STAFF" },
        select: { id: true, language: true },
      });
      if (coaches.length === 0) return;
      await tx.notification.createMany({
        data: coaches.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  createForPhysicalCoach(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { role: "COACHING_STAFF", coachingRole: "PHYSICAL_COACH" },
        select: { id: true, language: true },
      });
      if (users.length === 0) return;
      await tx.notification.createMany({
        data: users.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  async createForUser(userId: number, type: string, getMsg: MsgFactory, entityId?: number) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const { title, body } = getMsg(userRecord?.language ?? 'ko');
    return this.prisma.notification.create({
      data: { userId, type, title, body, ...(entityId && { entityId }) } as any,
    });
  }

  async createForGuardian(guardianUserId: number, type: string, getMsg: MsgFactory, entityId?: number) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: guardianUserId },
      select: { language: true },
    });
    const { title, body } = getMsg(userRecord?.language ?? 'ko');
    return this.prisma.notification.create({
      data: { userId: guardianUserId, type, title, body, ...(entityId && { entityId }) } as any,
    });
  }

  createForFinanceManager(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { role: "FRONT_OFFICE", frontOfficeRole: "FINANCE_MANAGER" },
        select: { id: true, language: true },
      });
      if (users.length === 0) return;
      await tx.notification.createMany({
        data: users.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
    });
  }

  async createForUsers(
    userIds: number[],
    type: string,
    getMsg: (locale?: string) => { title: string; body: string },
    entityId?: number,
  ) {
    if (userIds.length === 0) return;
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => {
        const { title, body } = getMsg();
        return { userId, type, title, body, ...(entityId !== undefined && { entityId }) } as any;
      }),
    });
  }

  createForAllStaff(type: string, getMsg: MsgFactory, entityId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { role: { notIn: ["PLAYER", "AGENT"] } },
        select: { id: true, language: true },
      });
      if (users.length === 0) return;
      await tx.notification.createMany({
        data: users.map((u) => {
          const { title, body } = getMsg(u.language);
          return { userId: u.id, type, title, body, entityId };
        }) as any,
      });
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

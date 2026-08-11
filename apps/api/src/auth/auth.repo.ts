import { PrismaClient } from "../generated/client";
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";
import crypto from "crypto";

interface CreateUserData {
  email: string;
  password: string;
  username: string;
  nickname: string;
  role: Role;
  coachingRole?: CoachingRole | null;
  frontOfficeRole?: FrontOfficeRole | null;
  dateOfBirth: Date;
  nationalityId: number;
  phoneNumber: { encrypted: string; iv: string };
}

export class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, username: true, nickname: true, role: true, coachingRole: true, frontOfficeRole: true, teamId: true, clubId: true, password: true, isDemo: true },
    });
  }

  isEmailTaken(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  isNicknameTaken(nickname: string) {
    return this.prisma.user.findUnique({ where: { nickname }, select: { id: true } });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, username: true, nickname: true, role: true, coachingRole: true, frontOfficeRole: true, teamId: true, clubId: true, language: true, isDeleted: true },
    });
  }

  updateLanguage(id: number, language: string) {
    return this.prisma.user.update({
      where: { id },
      data: { language },
      select: { id: true, language: true },
    });
  }

  createLoginHistory(data: { userId?: number; email: string; ip: string; userAgent: string; success: boolean }) {
    const userAgentHash = crypto.createHash('sha256').update(data.userAgent).digest('hex');
    return this.prisma.loginHistory.create({
      data: {
        userId: data.userId ?? null,
        email: data.email,
        ip: data.ip,
        userAgent: userAgentHash,
        success: data.success,
      },
    });
  }

  listLoginHistory(userId: number, limit = 50) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, email: true, ip: true, userAgent: true, success: true, createdAt: true },
    });
  }

  listAllLoginHistory(limit = 100) {
    return this.prisma.loginHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, email: true, ip: true, userAgent: true, success: true, createdAt: true,
        user: { select: { id: true, nickname: true } },
      },
    });
  }

  createInvite(data: { email: string; role: Role; coachingRole?: CoachingRole | null; frontOfficeRole?: FrontOfficeRole | null; createdById: number }) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.prisma.userInvite.create({
      data: {
        token,
        email: data.email,
        role: data.role,
        coachingRole: data.coachingRole ?? null,
        frontOfficeRole: data.frontOfficeRole ?? null,
        expiresAt,
        createdById: data.createdById,
      },
    });
  }

  findInviteByToken(token: string) {
    return this.prisma.userInvite.findUnique({ where: { token } });
  }

  markInviteUsed(id: number) {
    return this.prisma.userInvite.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  blacklistToken(jti: string, expiresAt: Date) {
    return this.prisma.refreshTokenBlacklist.create({ data: { jti, expiresAt } });
  }

  isTokenBlacklisted(jti: string) {
    return this.prisma.refreshTokenBlacklist.findUnique({ where: { jti }, select: { jti: true } });
  }

  deleteExpiredBlacklistEntries() {
    return this.prisma.refreshTokenBlacklist.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  async getDepartmentCategories(userId: number): Promise<string[]> {
    const rows = await this.prisma.userDepartment.findMany({
      where: { userId },
      select: { department: { select: { category: true } } },
    });
    const categories = rows.map((r) => r.department.category).filter((c) => c !== null) as string[];
    return [...new Set(categories)];
  }

  listInvites(limit = 50) {
    return this.prisma.userInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, email: true, role: true, coachingRole: true, frontOfficeRole: true,
        expiresAt: true, usedAt: true, createdAt: true,
        createdBy: { select: { id: true, nickname: true } },
      },
    });
  }

  async createUser(data: CreateUserData) {
    const phone = await this.prisma.phoneNumber.create({
      data: { encrypted: data.phoneNumber.encrypted, iv: data.phoneNumber.iv },
    });
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        username: data.username,
        nickname: data.nickname,
        role: data.role,
        coachingRole: data.coachingRole ?? null,
        frontOfficeRole: data.frontOfficeRole ?? null,
        dateOfBirth: data.dateOfBirth,
        nationalityId: data.nationalityId,
        phoneNumberId: phone.id,
      },
      select: { id: true, email: true, username: true, nickname: true, role: true, coachingRole: true, frontOfficeRole: true },
    });
  }

  anonymizeUser(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: {
        email: `deleted_${id}@deleted.com`,
        username: `deleted_${id}`,
        nickname: `deleted_${id}`,
        password: "",
        isDeleted: true,
      },
      select: { id: true, email: true, isDeleted: true },
    });
  }

  async exportUserData(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        role: true,
        language: true,
        player: {
          select: {
            id: true,
            playerName: true,
            position: true,
            level: true,
            status: true,
            contracts: {
              select: { id: true, startDate: true, endDate: true, status: true },
              orderBy: { startDate: "desc" as const },
            },
            injuries: {
              select: { id: true, bodyPart: true, cause: true, status: true, occurredAt: true },
              orderBy: { occurredAt: "desc" as const },
            },
          },
        },
        loginHistory: {
          select: { ip: true, success: true, createdAt: true },
          orderBy: { createdAt: "desc" as const },
          take: 100,
        },
      },
    });

    if (!user) return null;

    const { player, ...profile } = user;
    return { profile, player: player ?? null };
  }
}

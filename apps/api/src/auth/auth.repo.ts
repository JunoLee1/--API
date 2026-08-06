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
      select: { id: true, email: true, username: true, nickname: true, role: true, coachingRole: true, frontOfficeRole: true, teamId: true, clubId: true, language: true },
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
    return this.prisma.loginHistory.create({
      data: {
        userId: data.userId ?? null,
        email: data.email,
        ip: data.ip,
        userAgent: data.userAgent,
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
}

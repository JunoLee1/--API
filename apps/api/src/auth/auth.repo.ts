import { PrismaClient } from "../generated/client";
import { Role, CoachingRole, FrontOfficeRole } from "../generated/enums";

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
      select: { id: true, email: true, username: true, nickname: true, role: true, coachingRole: true, frontOfficeRole: true, password: true },
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
      select: { id: true, email: true, username: true, nickname: true, role: true, coachingRole: true, frontOfficeRole: true },
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

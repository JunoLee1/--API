import { PrismaClient } from "../generated/client";
import { Role } from "../generated/client";
import { SignUpInputRepoDto } from "./dto/auth.repo.dto";

type UserUpdateData = Parameters<PrismaClient["user"]["update"]>[0]["data"];

export class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async isNicknameDuplicated(nickname: string) {
    return await this.prisma.user.findUnique({ where: { nickname } });
  }

  async isEmailDuplicated(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return !!user;
  }

  async isDuplicatedPhoneNumber(encrypted: string) {
    const record = await this.prisma.phoneNumber.findUnique({ where: { encrypted } });
    return !!record;
  }

  async findAdvisorById(id: number) {
    return await this.prisma.user.findUnique({
      where: { id },
      include: { nationality: true, phoneNumber: true },
    });
  }

  async createAdmin(data: SignUpInputRepoDto) {
    return await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        nickname: data.nickname,
        username: data.username,
        dateOfBirth: data.dateOfBirth,
        role: data.role,
        isDeleted: false,
        nationality: { connect: { code: data.nationality.code } },
        phoneNumber: {
          create: {
            iv: data.phoneNumber.iv,
            encrypted: data.phoneNumber.encrypted,
          },
        },
      },
      include: { nationality: true, phoneNumber: true },
    });
  }

  async findAdvisorsByIds(ids: number[]) {
    return await this.prisma.user.findMany({ where: { id: { in: ids } } });
  }

  async findAdvisors({ where }: any) {
    return await this.prisma.user.findMany({
      where,
      include: { nationality: true },
    });
  }

  async updatesAdvisor(id: number, data: UserUpdateData) {
    return await this.prisma.user.update({
      where: { id },
      include: { phoneNumber: true, nationality: true },
      data,
    });
  }

  async deleteMany(data: { ids: number[]; isDeleted: boolean }) {
    return await this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: data.ids }, isDeleted: false },
      });
      await tx.user.updateMany({
        where: { id: { in: data.ids }, isDeleted: false },
        data: { isDeleted: true },
      });
      return users;
    });
  }
}

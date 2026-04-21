//import AuthService from "./auth.service";
//import prisma from "../lib/prisma";
import { PrismaClient } from "../generated/client";
import { Role } from "../generated/client";
import {
  LoginInput,
  signUpInputDto,
  signUpInputServiceDto,
  signUpOutputDto,
  encryptedPhoneNumberType,
  UpdateUserInputDTO,
} from "./auth.DTO";

export class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  //=================================================================================================================================================================================
  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }
  //=================================================================================================================================================================================
  async isNicknameDuplicated(nickname: string) {
    const result = await this.prisma.user.findUnique({
      where: { nickname },
    });
    return result;
  }

  async isEmailDuplicated(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }
  //=================================================================================================================================================================================
  async findAdvisorById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user;
  }
  //=================================================================================================================================================================================
  async createAdmin(data: signUpInputServiceDto): Promise<signUpOutputDto> {
    const newAdmin = await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        nickname: data.nickname,
        username: data.username,
        date_of_birth: data.birth_date,
        role: Role.ADMIN,
        nationality: {
          connect: {
            id: data.country.id,
          },
        },

        isDeleted: false,
        phoneNumber: {
          create: {
            iv: data.phoneNumber.iv,
            encrypted: data.phoneNumber.encrypted,
          },
        },
      },
      include: {
        phoneNumber: true,
        nationality: true,
      },
    });
    return {
      email: newAdmin.email,
      username: newAdmin.username,
      nickname: newAdmin.nickname,
    };
  }
  //=================================================================================================================================================================================
  async findAdvisorsByIds(ids: number[]) {
    const admins = await this.prisma.user.findMany({
      where: {
        in: {
          ids,
        },
      },
    });
    return admins;
  }
  //=================================================================================================================================================================================
  async findAdvisors({ where }: any) {
    return [];
  }
  //=================================================================================================================================================================================
  async updatesAdvisor(data: UpdateUserInputDTO) {
    const admins = await this.prisma.user.update({
      where: { id: data.id },
      data: data,
    });
    return admins;
  }

  //=================================================================================================================================================================================
  async delete(id: any) {
    return;
  }
  async deleteMany(data: any) {
    return [];
  }
  async updateAdvisorsStatus(data: any) {
    return [];
  }
}

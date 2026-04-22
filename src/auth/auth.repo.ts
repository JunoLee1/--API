//import AuthService from "./auth.service";
//import prisma from "../lib/prisma";
import { PrismaClient ,Prisma} from "../generated/client";
import { Role } from "../generated/client";
import {
  signUpOutputDto,
  UpdateUserInputDTO,
} from "./dto/auth.DTO";
import { SignUpInputRepoDto } from "./dto/auth.repo.dto";


type UserUpdateData =
  Parameters<PrismaClient["user"]["update"]>[0]["data"];

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
      include:{
        team:true
      }
    });
    return user;
  }
  //=================================================================================================================================================================================
  async createAdmin(data: SignUpInputRepoDto): Promise<signUpOutputDto> {
    const newAdmin = await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        nickname: data.nickname,
        username: data.username,
        date_of_birth: data.date_of_birth,
        role: Role.ADMIN,
        team:{
          connect:{
            team_name:data.team.name
          }
        },
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
        id :{
          in: ids,
        }
      },
    });
    return admins;
  }
  //=================================================================================================================================================================================
  async findAdvisors({ where }: any) {
    const admins = await this.prisma.user.findMany({
      where,
      include:{
        team:true
      }
    })
    return admins
  }
  //=================================================================================================================================================================================
  async updatesAdvisor(id:number,data: UserUpdateData) {
    const admins = await this.prisma.user.update({
      where: { id},
      data
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

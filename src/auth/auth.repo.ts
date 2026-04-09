import AuthService from "./auth.service";
import prisma from "../lib/prisma";
import type { PrismaClient } from "@prisma/client";
import { LoginInput } from "./auth.DTO";
export default class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  //=================================================================================================================================================================================
  async findByEmail(email: string) {
    console.log(1)
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
  async findAdvisorById(id: any) {
    return null;
  }
  //=================================================================================================================================================================================
  async findAdvisorsByIds(ids: any) {
    return [];
  }
  //=================================================================================================================================================================================
  async findAdvisors({ where }: any) {
    return [];
  }
  //=================================================================================================================================================================================
  async updatesAdvisor(id: any, { isDeleted }: any) {
    return null;
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

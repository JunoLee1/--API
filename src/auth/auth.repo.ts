//import AuthService from "./auth.service";
//import prisma from "../lib/prisma";
import type { PrismaClient } from "@prisma/client";
import { LoginInput, signUpInputDto,signUpInputServiceDto, signUpOutputDto } from "./auth.DTO";
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
  async findAdvisorById(id:number) {
    const user = await this.prisma.user.findUnique({
      where:{id} 
    })
    return user
  }
  //=================================================================================================================================================================================
  async createAdmin(data:signUpInputServiceDto):Promise<signUpOutputDto>{
    const newAdmin = await this.prisma.user.create({
      data:{
        email:data.email,
        password: data.email
      }
    })
    return newAdmin
  }
  //=================================================================================================================================================================================
  async findAdvisorsByIds(ids: number[]) {
    const admins = await this.prisma.findMany({
      where:{
        in:{
          ids
        }
      }
    })
    return admins
  }
  //=================================================================================================================================================================================
  async findAdvisors({ where }: any) {
    return [];
  }
  //=================================================================================================================================================================================
  async updatesAdvisor(data:any) {
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

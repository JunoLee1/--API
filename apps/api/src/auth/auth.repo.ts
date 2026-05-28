//import AuthService from "./auth.service";
//import prisma from "../lib/prisma";
import { PrismaClient ,Prisma, Status} from "../generated/client";
import { Role } from "../generated/client";
import { SignUpInputRepoDto,SignUpOutputDto,
  UpdateUserInputDTO, } from "./dto/auth.repo.dto";


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
//=================================================================================================================================================================================
  async isEmailDuplicated(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }
//=================================================================================================================================================================================
  async isDuplicatedPhoneNumber(encrypted:string){
    const userPH = await this.prisma.phoneNumber.findUnique({
      where:{
        encrypted
      },
    })
    return !! userPH;
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
  async createAdmin(data: SignUpInputRepoDto){
    const newAdmin = await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        nickname: data.nickname,
        username: data.username,
        date_of_birth: data.date_of_birth,
        role: data.role,
        status:Status.ACTIVE,
        team:{
          connect:{
            id:data.team.id
          }
        },
        nationality: {
          connect: {
            code: data.nationality!.code,
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
        team:true,
        phoneNumber: true,
        nationality: true,
      },
    });
    return newAdmin
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
        team:true,
      }
    })
    return admins
  }
  //=================================================================================================================================================================================
  async updatesAdvisor(id:number,data: UserUpdateData) {
    const admin = await this.prisma.user.update({
      where: { id },
      include:{
        phoneNumber:true,
        team:true,
        nationality:true,
      },
      data
    });
    console.log("repo:", admin)
    return admin;
  }

  //=================================================================================================================================================================================
  async delete(id: any) {
    return;
  }
  async deleteMany(data:{ids: number[], isDeleted:boolean}) {
    console.log(12)
    return await this.prisma.$transaction(async(tx) => {
      const admins = await tx.user.findMany({
        where: {
          id:{in: data.ids},
          isDeleted:false,
          role:"ADMIN"
        },
       
      })
      await tx.user.updateMany({
        where:{
          id:{in:data.ids},
          role:"ADMIN",
          isDeleted:false
        },
        data:{
           isDeleted:false,
        }
      })
      return admins
    })
  }
  async updateAdvisorStatus(data:{id:number,status:Status}[]) {
    console.log("data:",data)
    if (!data.length) return [];
    
    return await this.prisma.$transaction(
      data.map(item  => 
        this.prisma.user.update({
          where:{
            id:item.id,
          },
          data:{
            status:item.status
          }
        })
      )
    )
  }
}

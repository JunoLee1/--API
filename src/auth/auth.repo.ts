import AuthService from "./auth.service";
//import { PrismaClient } from "@prisma/client";
export default class AuthRepository {
  //prisma: PrismaClient
  constructor() {
    //this.prisma = new PrismaClient();
  }
  async create() {
    //this.prisma.create()
  }

  async accesses() {}

  async isEmailDuplicated(email: any) {
    return false;
  }
  async isNicknameDuplicated(nickname: string): Promise<boolean> {
    return false;
  }
  access() {}

  update() {}

  delete() {}
}

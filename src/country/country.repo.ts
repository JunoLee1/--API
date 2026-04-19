import { PrismaClient } from '@prisma/client';
export default class Repository {
  constructor(
    private prisma: PrismaClient
  ) {}

  async getCountryByCode(code: string) {
    const result = this.prisma.country.findUnique({
        where:{code}
    })
    return result
  }

  async getCountries(where:any) {
    const result = this.prisma.country.findMany({
        where:where
    })
    return result
  }
  async saveCountries(data:any){
    const result = this.prisma.country.createMany({
        data,
        skipDuplicates:true
    })
    return result
  }
}

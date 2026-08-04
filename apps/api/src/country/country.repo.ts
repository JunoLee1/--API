import { PrismaClient } from '../generated/client';
export default class Repository {
  constructor(
    private prisma: PrismaClient
  ) {}

  async findById(id: number) {
    return this.prisma.country.findUnique({ where: { id }, select: { id: true, code: true, name: true } });
  }

  async getCountryByCode(code: string) {
    const result = this.prisma.country.findFirst({
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

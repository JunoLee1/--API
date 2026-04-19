import Repository from "./country.repo";
import { CountryApiClient } from "../externalAPI";
import { PrismaClient } from '@prisma/client';
export default class Service {
  constructor(
    private clientApi = new CountryApiClient(),
    private repo = new Repository( new PrismaClient()),
  ) {}

  registerCountries = async () => {
    const externalData = await this.clientApi.getAllCountries();
    if (!externalData || externalData.length === 0) {
      throw new Error("외부 데이터 없음");
    }
    const mapped = externalData.map((c: any) => ({
      code: c.cca2,
      name: c.name.common,
      region: c.region,
    }));
    await this.repo.saveCountries(mapped);
    return mapped;
  };
  getCountryByCode = async (code: string) => {
    if (!code) throw new Error("invalid code");
    const DB_result: any = await this.repo.getCountryByCode(code);
   
    if (DB_result) return DB_result;
    const external = await this.clientApi.getCountryByCode(code);
    if (!external) throw new Error("invalid country");
    const mapped = {
      code: external.code,
      region: external.region,
      name: external.name
    };
    return mapped;
  };
  getCountries = async ({ name, code, region }: any) => {
    const where: any = {};
    if (name) {
      where.name = name;
    }
    if (code) {
      where.code = code;
    }
    if (region) {
      where.region = region;
    }
    const DB_result = await this.repo.getCountries(where);
    if (DB_result.length > 0) return DB_result;
    const external = await this.clientApi.getAllCountries()
    if(!external || external.length <= 0) throw new Error("Invalid Countries")

    const filtered = external.map((c:any) => ({
        code: c.code,
        name: c.name,
        region: c.region
    })).filter((c:any) => {
        if(code && c.code !== code) return false
        if(name && c.name !== name) return false
        if(region && c.region !== region) return false
        return true
    })
    return filtered;
  };
}

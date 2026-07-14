import Repository from "./country.repo";
import { CountryApiClient } from "../externalAPI";
export default class Service {
  constructor(
    private clientApi : CountryApiClient,
    private repo: Repository,
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
    const total = await this.repo.getCountries({});
    if (total.length < 50) {
      await this.registerCountries().catch(() => null);
    }

    const where: any = {};
    if (name) where.name = name;
    if (code) where.code = code;
    if (region) where.region = region;

    return this.repo.getCountries(where);
  };
}

import Service from "./country.service";

export default class Controller {
  constructor(private service: Service) {}

  getCountry = async (req: any, res: any) => {
    try {
      const { code } = req.params;
      const result = await this.service.getCountryByCode(code);
      return res.status(200).json({ message: "성공적으로 데이터를 가지고 왔습니다.", data: result });
    } catch (error) {
      return res.status(500).json({ message: "INTERNAL SERVER ERROR" });
    }
  };

  getCountries = async (req: any, res: any) => {
    try {
      const name = req.query["name"] as string | undefined;
      const region = req.query["region"] as string | undefined;
      const code = req.query.code ? (req.query.code as string).toUpperCase() : undefined;
      const result = await this.service.getCountries({ name, code, region });
      return res.status(200).json({ message: "성공적으로 데이터를 가지고 왔습니다.", data: result });
    } catch (error) {
      return res.status(500).json({ message: "INTERNAL SERVER ERROR" });
    }
  };
}

import Service from "./country.service";

export default class Controller {
  constructor(private service: Service) {}
  async getCountry(req: any, res: any) {
    try {
      const { code } = req.params;
      const result = await this.service.getCountryByCode(code);

      return res.status(200).json({
        message: "성공적으로 데이터를 가지고 왔습니다.",
        data: result,
      });
    } catch(error) {
      return res.status(500).json({
        message: "INTERNAL SERVER ERROR",
      });
    }
  }
  async getCountries (req:any, res:any){
    try{
      const {name, code, region} = req.query as any
      let uppper = ""
      if(!this.isUpperCase(code)){
        uppper = code.toUpperCase()
      }
      const result = await this.service.getCountries({name, code, region})
      return res.status(200).json({
        message: "성공적으로 데이터를 가지고 왔습니다.",
        data: result,
      });
    }catch(error){
     return res.status(500).json({
        message: "INTERNAL SERVER ERROR",
      });
    }
  }
  
  isUpperCase(str:string){
    return str === str.toUpperCase()
  }
}

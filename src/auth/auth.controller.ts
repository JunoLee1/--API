import AuthService from "./auth.service";
import {LoginInput} from "./auth.DTO"
export default class AuthController {
  constructor(private service: AuthService) {}
  async signUp(req: any, res: any) {
    try {
      const result = await this.service.signUp(req.body);
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(500).json({ message: "Something Wrong" });
    }
  }
  //=================================================================================================================================================================================

  async login(req: any, res: any) {//TODO: TYPE CONVERT
    try {
      const { email, password } = req.body as LoginInput;
      const result = await this.service.login({ email, password });
      return res.status(200).json(result);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Something Wrong" });
    }
  }
  //=================================================================================================================================================================================
  async findAdvisorById(req: any, res: any) {//TODO: TYPE CONVERT
    try {
        const{ id } = req.params
        if(!req.user){
          return res.status(401).json({message:"UNAUTHORIZED"})
        }
        const advisor = await this.service.findAdvisorById(id)
        console.log(1)
        if(advisor.role !== "SUPER_ADMIN") return res.status(403).json("FORBIDDEN")
        console.log("advisor.role:",  advisor.role)
        return res.status(200).json()
    } catch (error) {
      return res.status(500).json({ message: "Something Wrong" });
    }
  }
  //=================================================================================================================================================================================

  async findAdvisors(req: any, res: any) {//TODO: TYPE CONVERT
    try{
      const {take, limit} = req.query as any //TODO: TYPE CONVERT
      if(!req.user){
        return res.status(401).json({message:"UNAUTHORIZED"})
      }
      if(req.user.role !== "SUPER_ADMIN"){
        return res.status(403).json({message:"FORBIDDEN"})
      }
      await this.service.findAdvisors({take, limit})
      return res.status(200).json()
    }catch(error){
      return res.status(500).json({ message: "Something Wrong" });
    }
  }
  //=================================================================================================================================================================================

  async update() {}
  //=================================================================================================================================================================================

  async delete() {}
}

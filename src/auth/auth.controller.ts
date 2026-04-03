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

  async login(req: any, res: any) {
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
  async findAdvisorById(req: any, res: any) {
    try {
        const{ id } = req.params
        
        const userId = req.user?.sub
        const advisor = await this.service.findAdvisorById(id)
        if(advisor.userId !== req.user?.id) return res.status(403).json({message:"FORBIDDEN"})
        return res.status(200).json()
    } catch (error) {
      return res.status(500).json({ message: "Something Wrong" });
    }
  }
  //=================================================================================================================================================================================

  async findAdvisors(req: any, res: any) {}
  //=================================================================================================================================================================================

  async update() {}
  //=================================================================================================================================================================================

  async delete() {}
}

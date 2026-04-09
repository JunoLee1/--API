import AuthService from "./auth.service";
import { LoginInput } from "./auth.DTO";
export default class AuthController {
  constructor(private service: AuthService) {}
  async signUp(req: any, res: any) {
    try {
      const result = await this.service.signUp(req.body);
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }
  //=================================================================================================================================================================================

  async login(req: any, res: any) {
    //TODO: TYPE CONVERT
    try {
      const { email, password } = req.body as LoginInput;
      const result = await this.service.login({ email, password });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }
  //=================================================================================================================================================================================
  async findAdvisorById(req: any, res: any) {
    //TODO: TYPE CONVERT
    try {
      //const { teamName, userName } = req.query
      console.log(req);

      if (!req.user.id) {
        return res.status(401).json({ message: "UNAUTHORIZED" });
      }
      const id = req.user.id 
      if (req.user.role !== "SUPER_ADMIN")
        return res.status(403).json({ message: "FORBIDDEN" });
      await this.service.findAdvisorById(id);
      return res.status(200).json();
    } catch (error) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }
  //=================================================================================================================================================================================

  async findAdvisors(req: any, res: any) {
    //TODO: TYPE CONVERT
    try {
      const { take, page, teamname, username } = req.query as any; //TODO: TYPE CONVERT
      if (!req.user.id) {
        return res.status(401).json({ message: "UNAUTHORIZED" });
      }
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ message: "FORBIDDEN" });
      }
      const result = await this.service.findAdvisors(
        {
          take,
          page,
        },
        { teamname, username },
      );

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }
  //=================================================================================================================================================================================
  async updatesAdvisor(req: any, res: any) {
    try {
      if (!req.user.id)
        return res.status(401).json({ message: "UNAUTHORIZED" });
      const id = req.params;

      const { teamname, username, isDeleted } = req.body; //TODO: add fields more after test
      await this.service.updatesAdvisor(id, { teamname, username, isDeleted });
      return res.status(200).json({
        message: "successfully modified information",
      });
    } catch (error) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }
  //=================================================================================================================================================================================
  async updateAdvisorsStatus(req: any, res: any) {
    try {
      if (!req.user.id)
        return res.status(401).json({ message: "UNAUTHORISED" });
      if (req.user.role !== "SUPER_ADMIN")
        return res.status(403).json({ message: "FORBIDDEN" });
      const { data } = req.body;
      await this.service.updateAdvisorsStatus(data);
      return res.status(200).json({ message: "상태 변경 완료" });
    } catch (error) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR"});
    }
  }
  //=================================================================================================================================================================================
  async delete(req: any, res: any) {
    try {
      if (!req.user.id)
        return res.status(401).json({
          message: "UNAUTHORISED",
        });
      if (req.user.role !== "SUPER_ADMIN")
        return res.status(403).json({
          message: "FORBIDDEN",
        });
      const id = req.params;
      await this.service.delete(id);

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({
        message: "SERVER INTERNAL ERROR",
      });
    }
  }
  //=================================================================================================================================================================================
  async deleteMany(req: any, res: any) {
    try {
      if (!req.user.id) {
        return res.status(401).json({
          message: "UNAUTHORIZED",
        });
      }
      if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          message: "FORBIDDEN",
        });
      }

      const { data } = req.body;
      await this.service.deleteMany(data);
      res.status(204).send();
    } catch (error) {
      return res.status(500).json({
        message: "SERVER INTERNAL ERROR",
      });
    }
  }
}

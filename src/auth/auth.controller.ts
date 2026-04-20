import AuthService from "./auth.service";
import { LoginInput , signUpInputDto, paramsType, Role} from "./auth.DTO";
import {Request, Response } from "express-serve-static-core";
//import { User} from "@prisma/client";
export default class AuthController {
  constructor(private service: AuthService) {}
  async signUp(req: Request<{}, {}, signUpInputDto>, res: Response) {
    try {
      const result = await this.service.signUp(req.body);
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }

  //=================================================================================================================================================================================
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body as LoginInput;
      const result = await this.service.login({ email, password });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }
  
  //=================================================================================================================================================================================

  async findAdvisorById(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "UNAUTHORIZED" });
      }
      if (req.user.role !== Role.SUPER_ADMIN)
        return res.status(403).json({ message: "FORBIDDEN" });
      const id = Number(req.params.id)
      const result = await this.service.findAdvisorById(id);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }
  //=================================================================================================================================================================================

  async findAdvisors(req: Request, res: Response) {
    try {
      const { take, page, teamname, username } = req.query as any; //TODO: TYPE CONVERT
      if (!req.user?.id) {
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
  async updatesAdvisor(req: Request, res: Response) {
    try {
      if (!req.user?.id)
        return res.status(401).json({ message: "UNAUTHORIZED" });
      const id = Number(req.params);

      const { teamname, username, email, password,phoneNumber, country, role} = req.body;
      await this.service.updatesAdvisor({id, email, teamname, username, password, country,phoneNumber, role});
      return res.status(200).json({
        message: "successfully modified information",
      });
    } catch (error) {
      return res.status(500).json({ message: "SERVER INTERNAL ERROR" });
    }
  }
  //=================================================================================================================================================================================
  async updateAdvisorsStatus(req: Request, res: Response) {
    try {
      if (!req.user?.id)
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
  async delete(req: Request, res: Response) {
    try {
      if (!req.user?.id)
        return res.status(401).json({
          message: "UNAUTHORISED",
        });
      if (req.user.role !== "SUPER_ADMIN")
        return res.status(403).json({
          message: "FORBIDDEN",
        });
      const id = Number(req.params);
      await this.service.delete(id);

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({
        message: "SERVER INTERNAL ERROR",
      });
    }
  }
  //=================================================================================================================================================================================
  async deleteMany(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
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

import AuthService from "./auth.service";
//import { Role } from "../../generated/enums";
import {
  SignUpInputDto,
  LoginInput,
  QueryType,
  ParamsDto,
} from "./dto/auth.controller.dto";
import { Request, Response, NextFunction } from "express-serve-static-core";
import { AppError } from "../lib/appError";
//import { User} from "@prisma/client";
export default class AuthController {
  constructor(private service: AuthService) {}
  signUp = async (
    req: Request<{}, {}, SignUpInputDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.service.signUp(req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  //=================================================================================================================================================================================
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as LoginInput;
      const result = await this.service.login({ email, password });
      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  //=================================================================================================================================================================================

  findAdvisorById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED");
      }
      if (req.user.role !== "SUPER_ADVISOR")
        throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params.id);
      const user = await this.service.findAdvisorById(id);
      return res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  //=================================================================================================================================================================================

  async findAdvisors(req: Request, res: Response, next: NextFunction) {
    try {
      const { take, page, team, username } =
        req.query as unknown as QueryType;
      if (!req.user?.id) {
        throw new AppError(401, "UNAUTHORIZED");
      }
      if (req.user.role !== "SUPER_ADVISOR") {
        throw new AppError(403, "FORBIDDEN");
      }
      const numTake = Number(take) || 10;
      const numPage = Number(page) || 1;
      const skip = (numPage - 1) * numTake;
      if (skip > 0) throw new Error("LIMIT은 음수가 되어선 안됩니다");

      const result = await this.service.findAdvisors({
        skip,
        take: numTake,
        team,
        username,
      });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
  //=================================================================================================================================================================================
  async updatesAdvisor(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      const id = Number(req.params);

      const {
        team,
        username,
        email,
        password,
        phoneNumber,
        nationality,
        role,
      } = req.body;
      await this.service.updatesAdvisor({
        id,
        email,
        team,
        username,
        password,
        nationality,
        phoneNumber,
        role,
      });
      return res.status(200).json({
        message: "successfully modified information",
      });
    } catch (error) {
      next(error);
    }
  }
  //=================================================================================================================================================================================
  async updateAdvisorsStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      if (req.user.role !== "SUPER_ADVISOR")
        throw new AppError(403, "FORBIDDEN");
      const { data } = req.body;
      await this.service.updateAdvisorsStatus(data);
      return res.status(200).json({ message: "상태 변경 완료" });
    } catch (error) {
      next(error);
    }
  }
  //=================================================================================================================================================================================
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      if (req.user.role !== "SUPER_ADVISOR")
        throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params);
      await this.service.delete(id);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
  //=================================================================================================================================================================================
  async deleteMany(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      if (req.user.role !== "SUPER_ADVISOR")
        throw new AppError(403, "FORBIDDEN");
      const { data } = req.body;
      await this.service.deleteMany(data);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

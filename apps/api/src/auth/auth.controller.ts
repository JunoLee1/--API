import AuthService from "./auth.service";
import { SignUpInputDto, LoginInput, QueryType } from "./dto/auth.controller.dto";
import { Request, Response, NextFunction } from "express-serve-static-core";
import { AppError } from "../lib/appError";

export default class AuthController {
  constructor(private service: AuthService) {}

  signUp = async (req: Request<{}, {}, SignUpInputDto>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.signUp(req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as LoginInput;
      const result = await this.service.login({ email, password });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  findAdvisorById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      if (req.user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      const user = await this.service.findAdvisorById(id);
      return res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  findAdvisors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      if (req.user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const { take, page, username } = req.query as unknown as QueryType;
      const numTake = Number(take) || 10;
      const numPage = Number(page) || 1;
      const skip = (numPage - 1) * numTake;
      if (skip < 0) throw new AppError(400, "INVALID_PAGE");
      const result = await this.service.findAdvisors({ skip, take: numTake, username });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updatesAdvisor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      const id = Number(req.params["id"]);
      const { username, email, password, role, dateOfBirth, nickname, isDeleted } = req.body;
      await this.service.updatesAdvisor({ id, email, username, password, role, dateOfBirth, nickname, isDeleted });
      return res.status(200).json({ message: "successfully modified" });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      if (req.user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const id = Number(req.params["id"]);
      await this.service.delete(id);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  deleteMany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) throw new AppError(401, "UNAUTHORIZED");
      if (req.user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const { data } = req.body;
      await this.service.deleteMany(data);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

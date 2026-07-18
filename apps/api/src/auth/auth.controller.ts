import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, COOKIE_OPTIONS } from "../lib/constants";
import { AuthService } from "./auth.service";

export class AuthController {
  constructor(private service: AuthService) {}


  // 나중에 lib나 미들웨어로 이사 고려
  private getAuthenticatedUser(req: Request) {
    const user = req.user;
    if (!user || typeof user !== "object") throw new AppError(401, "UNAUTHORIZED");

    const userId = Number((user as { id?: unknown }).id);
    if (!Number.isFinite(userId)) throw new AppError(401, "UNAUTHORIZED");

    const role = (user as { role?: unknown }).role;
    if (typeof role !== "string") throw new AppError(401, "UNAUTHORIZED");

    return { id: userId, role };
  }

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessToken, refreshToken } = await this.service.login(req.body);
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, COOKIE_OPTIONS);
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
      res.status(200).json({ message: "OK" });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const tokens = (await import("../lib/token")).generateTokens({
        id: user.id,
        role: user.role,
        coachingRole: user.coachingRole ?? null,
        frontOfficeRole: user.frontOfficeRole ?? null,
      });
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, COOKIE_OPTIONS);
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, COOKIE_OPTIONS);
      res.status(200).json({ message: "OK" });
    } catch (err) {
      next(err);
    }
  };

  logout = (_req: Request, res: Response) => {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME);
    res.status(200).json({ message: "OK" });
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userInfo = this.getAuthenticatedUser(req);
      const user = await this.service.me(userInfo.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userInfo = this.getAuthenticatedUser(req);
      if (userInfo.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const user = await this.service.createUser(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  };
}

import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "../lib/constants";
import { AuthService } from "./auth.service";

const COOKIE_OPTS = { httpOnly: true, sameSite: "strict" as const };

export class AuthController {
  constructor(private service: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessToken, refreshToken } = await this.service.login(req.body);
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, COOKIE_OPTS);
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, COOKIE_OPTS);
      res.status(200).json({ message: "OK" });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role } = req.user!;
      const { accessToken, refreshToken } = { accessToken: "", refreshToken: "" };
      // re-issue both tokens using the validated refresh token payload
      const tokens = (await import("../lib/token")).generateTokens(id, role);
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, COOKIE_OPTS);
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, COOKIE_OPTS);
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
      const user = await this.service.me(req.user!.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN");
      const user = await this.service.createUser(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  };
}

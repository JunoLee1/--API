import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/appError";
import { isAdminLike } from "../lib/permissions";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, COOKIE_OPTIONS } from "../lib/constants";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repo";

export class AuthController {
  constructor(
    private service: AuthService,
    private repo: AuthRepository,
  ) {}


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
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const userAgent = req.get("user-agent") ?? "unknown";
    const email: string = req.body?.email ?? "";
    try {
      const { accessToken, refreshToken, userId } = await this.service.login(req.body);
      void this.repo.createLoginHistory({ userId, email, ip, userAgent, success: true }).catch(console.error);
      res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, COOKIE_OPTIONS);
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
      res.status(200).json({ message: "OK" });
    } catch (err) {
      void this.repo.createLoginHistory({ email, ip, userAgent, success: false }).catch(console.error);
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
        teamId: user.teamId ?? null,
        clubId: user.clubId ?? null,
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

  updateLanguage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = this.getAuthenticatedUser(req);
      const { language } = req.body;
      if (language !== 'ko' && language !== 'en') throw new AppError(400, 'INVALID_LANGUAGE');
      await this.repo.updateLanguage(id, language);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userInfo = this.getAuthenticatedUser(req);
      if (!isAdminLike(userInfo.role)) throw new AppError(403, "FORBIDDEN");
      const user = await this.service.createUser(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  };

  loginHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userInfo = this.getAuthenticatedUser(req);
      if (!isAdminLike(userInfo.role)) throw new AppError(403, "FORBIDDEN");
      const userId = req.params["userId"] ? Number(req.params["userId"]) : undefined;
      const history = userId
        ? await this.repo.listLoginHistory(userId)
        : await this.repo.listAllLoginHistory();
      res.status(200).json(history);
    } catch (err) {
      next(err);
    }
  };
}

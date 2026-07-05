import { Strategy, ExtractJwt } from "passport-jwt";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, JWT_ACCESS_TOKEN_SECRET, JWT_REFRESH_TOKEN_SECRET } from "../../constants";
import { Request } from "express";

const accessTokenOptions = {
  jwtFromRequest: (req: Request) => req.cookies[ACCESS_TOKEN_COOKIE_NAME] as string | null,
  secretOrKey: JWT_ACCESS_TOKEN_SECRET,
};

const refreshTokenOptions = {
  jwtFromRequest: (req: Request) => req.cookies[REFRESH_TOKEN_COOKIE_NAME] as string | null,
  secretOrKey: JWT_REFRESH_TOKEN_SECRET,
};

export const jwtVerify = async (payload: Express.User, done: (err: unknown, user?: Express.User | false) => void) => {
  try {
    done(null, payload);
  } catch (err) {
    done(err, false);
  }
};

export const accessTokenStrategy = new Strategy(accessTokenOptions, jwtVerify);
export const refreshTokenStrategy = new Strategy(refreshTokenOptions, jwtVerify);

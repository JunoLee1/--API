import {
  JWT_ACCESS_TOKEN_SECRET,
  JWT_REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_NAME,
} from "../../constants";
import type { JwtPayload } from "jsonwebtoken";
import { Strategy as JwtStrategy } from 'passport-jwt';
const accessTokenOptions = {
  jwtFromRequest: (req: any) => req.cookies[ACCESS_TOKEN_COOKIE_NAME],
  secretOrKey: JWT_ACCESS_TOKEN_SECRET,
};
const refreshTokenOptions = {
  jwtFromRequest: (req: any) => req.cookies[REFRESH_TOKEN_COOKIE_NAME],
  secretOrKey: JWT_REFRESH_TOKEN_SECRET,
};
export const jwtVerify = async (payload: JwtPayload | Error, done: any) => {
  try {
    done(null, payload);
  } catch {
    done(Error, false);
  }
};
export const accessTokenStrategy = new JwtStrategy(
    accessTokenOptions,
    jwtVerify
)
export const refreshTokenStrategy = new JwtStrategy(
    refreshTokenOptions,
    jwtVerify
)

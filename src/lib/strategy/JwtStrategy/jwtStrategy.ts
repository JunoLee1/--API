import {
  JWT_ACCESS_TOKEN_SECRET,
  JWT_REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_NAME,
} from "../../constants";
import { Strategy as JwtStrategy } from "passport-jwt";
import { Role } from "../../../generated/enums";

type Payload = {
  sub : string | number,
  role : Role,
  iat?: number;
  exp?: number;
}
const accessTokenOptions = {
  jwtFromRequest: (req: any) => {
    console.log("cookie:",req.cookies[ACCESS_TOKEN_COOKIE_NAME])
    return req.cookies[ACCESS_TOKEN_COOKIE_NAME]},
  secretOrKey: JWT_ACCESS_TOKEN_SECRET,
};
const refreshTokenOptions = {
  jwtFromRequest: (req: any) => req.cookies[REFRESH_TOKEN_COOKIE_NAME],
  secretOrKey: JWT_REFRESH_TOKEN_SECRET,
};
export const jwtVerify = async (payload: Payload, done:any) => {
  console.log("🔥 토큰 인증")
  try {
    console.log("payload:", payload);
    done(null, { id: payload.sub, role: payload.role });
  } catch (err) {
    done(err, false);
  }
};
export const accessTokenStrategy = new JwtStrategy(
  accessTokenOptions,
  jwtVerify,
);
export const refreshTokenStrategy = new JwtStrategy(
  refreshTokenOptions,
  jwtVerify,
);

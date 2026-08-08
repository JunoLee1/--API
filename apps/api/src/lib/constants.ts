import dotenv from "dotenv";
dotenv.config();

const jwtAccessSecret = process.env["JWT_ACCESS_TOKEN_SECRET"];
if (!jwtAccessSecret) {
  throw new Error("JWT_ACCESS_TOKEN_SECRET environment variable is required but not set");
}

const jwtRefreshSecret = process.env["JWT_REFRESH_TOKEN_SECRET"];
if (!jwtRefreshSecret) {
  throw new Error("JWT_REFRESH_TOKEN_SECRET environment variable is required but not set");
}

export const JWT_ACCESS_TOKEN_SECRET = jwtAccessSecret;
export const JWT_REFRESH_TOKEN_SECRET = jwtRefreshSecret;
export const ACCESS_TOKEN_COOKIE_NAME = "access-token";
export const REFRESH_TOKEN_COOKIE_NAME = "refresh-token";
export const ACCESS_TOKEN_COOKIE_OPTIONS = { httpOnly: true, sameSite: "strict" as const, maxAge: 60 * 60 * 1000 };
export const REFRESH_TOKEN_COOKIE_OPTIONS = { httpOnly: true, sameSite: "strict" as const, maxAge: 7 * 24 * 60 * 60 * 1000 };

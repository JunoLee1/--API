import dotenv from "dotenv";
dotenv.config();

export const JWT_ACCESS_TOKEN_SECRET = process.env["JWT_ACCESS_TOKEN_SECRET"] ?? "jwt-access-secret";
export const JWT_REFRESH_TOKEN_SECRET = process.env["JWT_REFRESH_TOKEN_SECRET"] ?? "jwt-refresh-secret";
export const ACCESS_TOKEN_COOKIE_NAME = "access-token";
export const REFRESH_TOKEN_COOKIE_NAME = "refresh-token";
export const COOKIE_OPTIONS = { httpOnly: true, sameSite: "strict" as const };

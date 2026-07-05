import jwt from "jsonwebtoken";
import { JWT_ACCESS_TOKEN_SECRET, JWT_REFRESH_TOKEN_SECRET } from "./constants";
import { Role } from "../generated/enums";

export function generateTokens(id: number, role: Role) {
  const payload = { id, role };
  const accessToken = jwt.sign(payload, JWT_ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

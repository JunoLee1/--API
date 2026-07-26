import { sign, verify } from "jsonwebtoken";
import { JWT_ACCESS_TOKEN_SECRET, JWT_REFRESH_TOKEN_SECRET } from "./constants";
import { Role } from "../generated/enums";

const generateToken = async (id: any, role:Role) => {
  const accessToken = sign({ sub: id, role}, JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  const refreshToken = sign({ sub: id }, JWT_REFRESH_TOKEN_SECRET, {
    expiresIn: "1d",
  });
  return { accessToken, refreshToken };
};
/*
const verifyAccessToken = async (token: any) => {
    const decode = verify(token, JWT_ACCESS_TOKEN_SECRET)
    return { sub: decode.sub };
};

const verifyRefreshToken = async (token: any) => {
    const decode = verify(token, JWT_REFRESH_TOKEN_SECRET)
    return { sub: decode.sub };
};
*/
export { generateToken };

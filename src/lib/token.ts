import { sign, verify } from "jsonwebtoken";
import {JWT_ACCESS_TOKEN_SECRET, JWT_REFRESH_TOKEN_SECRET}from "./constants" 

const generateToken = async (userId: any) => {
  const accessToken = sign({ sub: userId }, JWT_ACCESS_TOKEN_SECRET, {
    expiresIn:"1h"
  });
  const refreshToken = sign({sub: userId}, JWT_REFRESH_TOKEN_SECRET, {
    expiresIn: "1d"
  })
};

const verifyAccessToken = async (token: any) => {
    const decode = verify(token, JWT_ACCESS_TOKEN_SECRET)
    return { userId: decode.sub };
};

const verifyRefreshToken = async (token: any) => {
    const decode = verify(token, JWT_REFRESH_TOKEN_SECRET)
    return { userId: decode.sub };
};

export { verifyAccessToken, verifyRefreshToken, generateToken };

import passport from "passport";
import { accessTokenStrategy, refreshTokenStrategy } from "./JwtStrategy/jwtStrategy";

passport.use("accessToken", accessTokenStrategy);
passport.use("refreshToken", refreshTokenStrategy);

export default passport;

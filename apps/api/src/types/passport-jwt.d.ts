declare module "passport-jwt" {
  import { Request } from "express";

  interface StrategyOptions {
    jwtFromRequest: (req: Request) => string | null;
    secretOrKey: string;
    passReqToCallback?: false;
  }

  type VerifyCallback = (
    payload: Express.User,
    done: (err: unknown, user?: Express.User | false) => void,
  ) => void | Promise<void>;

  class Strategy implements import("passport").Strategy {
    constructor(options: StrategyOptions, verify: VerifyCallback);
    authenticate(req: import("express").Request, options?: object): void;
  }

  const ExtractJwt: {
    fromAuthHeaderAsBearerToken: () => (req: Request) => string | null;
    fromExtractors: (extractors: Array<(req: Request) => string | null>) => (req: Request) => string | null;
  };
}

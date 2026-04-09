import type { Role } from "../src/auth.DTO";
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      teamname: string;
      email: string;
      password: string;
      role: Role; // "SUPER_ADMIN" 대신 Enum 타입을 직접 할당
      country:string;
      isDeleted?: boolean;
    }
    interface Request {
      user?: User
      params: {
        id: string;
      };
      body: any;
    }
  }
}

export {};

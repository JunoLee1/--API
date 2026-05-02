import type { Role } from "../src/auth.DTO";
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      team:Team,
      email: string;
      password: string;
      role: Role; // "SUPER_ADMIN" 대신 Enum 타입을 직접 할당
      country:string;
      isDeleted?: boolean;
      phoneNumber:PhoneNumber;

    }
    interface Country {
      id:number,
      name:string
    }
    interface PhoneNumber {
      iv:string;
      encrypted:string
    }
    interface Team {
      id:number
      team_name: string
      shorten_name: string
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

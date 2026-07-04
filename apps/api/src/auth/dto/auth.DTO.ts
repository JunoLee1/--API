import { Role } from "../../generated/enums";

export interface IAuth {
  id: number;
  username: string;
  nickname: string;
  email: string;
  password: string;
  role: Role;
  isDeleted?: boolean;
}

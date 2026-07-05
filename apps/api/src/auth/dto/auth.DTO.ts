import { Role } from "../../generated/enums";

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  confirmedPassword: string;
  username: string;
  nickname: string;
  role: Role;
  dateOfBirth: string;
  phoneNumber: string;
  nationalityId: number;
}

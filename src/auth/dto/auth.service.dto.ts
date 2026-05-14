import { Status } from "./auth.DTO";
import { Role } from "../../generated/enums";
export type LoginInputServiceDto = {
  email: string;
  password: string;
}
export type SignUpServicePasswordDto = {
  hashedPassword: string;
};
export type EncryptedPhoneNumberType = {
  encrypted: string;
  iv: string;
};
export type SignUpInputServiceDto = {
  //id: number;
  email: string;
  password: string;
  confirmedPassword:string;
  username: string;
  nickname: string;
  date_of_birth: Date;
  phoneNumber: string;
  team: {
    id: number;
    teamname: string;
  };
  nationality: {
    id: number;
    name: string;
    code : string;
  };
  role:Role;
};

export type LoginOutputServiceDto = {
  accessToken: string;
  refreshToken: string;
  role?: Role;
};
export type FindAdvisorsServiceDto = {
  skip: number;
  take: number;
  username: string | null;
  teamname: string | null;
};
export type FindAdvisorsOutputDto = {
  username: string | null;
  teamname: string | null;
  email: string;
  nickname: string;
}[];

export type UpdatedUserStatusDTO = {
  id: number;
  status: Status;
}[];
export type UpdatedUserStatusOutputDTO = {
  email: string;
  username: string;
  teamname: string;
  status: Status;
  nickname: string;
};


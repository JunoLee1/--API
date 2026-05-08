import { Status } from "./auth.DTO";
import { Role } from "../../generated/enums";
export type LoginInputServiceDto = {
  email: string;
  password: string;
};
export type signUpSevicePasswordDto = {
  hashedPassword: string;
};
export type encryptedPhoneNumberType = {
  encrypted: string;
  iv: string;
};
export type signUpInputServiceDto = {
  //id: number;
  email: string;
  password: string;
  confirmedPassword: string;
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
  role:Role
};

export type LoginOutputServiceDto = {
  accessToken: string;
  refreshToken: string;
};
export type findAdvisorsServiceDto = {
  skip: number;
  take: number;
  username: string | null;
  teamname: string | null;
};
export type findAdvisorsOutPutDto = {
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


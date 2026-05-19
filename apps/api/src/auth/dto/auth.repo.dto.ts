import { Role } from "../../generated/enums";
import { encryptedPhoneNumberType } from "./auth.service.dto";

export enum Status {
  INACTIVE = "INACTIVE",
  ACTIVE = "ACTIVE",
}
export type SignUpInputRepoDto = {
  email: string;
  password: string;
  username: string;
  nickname: string;
  date_of_birth: Date;
  phoneNumber: encryptedPhoneNumberType;
  role: Role
  team:{
    id:number,
    teamname:string
  }
  nationality: {
    id: number;
    name: string;
    code: string;
  };
};


export type UpdateUserInputDTO = {
  id: number; //TODO: migrate the type as string
  username?: string;
  teamname?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  role?: Role;
  nationality: {
    id: number;
    name: string;
    code: string;
  };
  isDeleted?: boolean;
  status?: Status;
};

export type UpdateUserOutputDTO = {
  id: number; // should change to string
  username: string;
  teamname: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: Role;
  country: {
    id: number;
    name: string;
    code: string;
  };
  isDeleted?: boolean;
  status?: Status;
};

export type signUpOutputDto = {
  email: string;
  username: string;
  nickname: string;
  team:{
    id: number,
    team_name: string,
  }
  nationality: {
    id: number;
    name: string;
    code: string;
  };
  role:Role,
  date_of_birth:Date
};

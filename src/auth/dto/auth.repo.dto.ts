import { encryptedPhoneNumberType } from "./auth.service.dto";

export enum Role {
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
  PLAYER = "PLAYER",
}
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
    teamname: string,
  }
  nationality: {
    id: number;
    name: string;
    code: string;
  };
};

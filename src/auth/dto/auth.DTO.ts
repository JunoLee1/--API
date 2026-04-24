
export type signUpOutputDto = {
  email: string;
  username: string;
  nickname: string;
};


export type InputData = {
  id: number;
};
export enum Role {
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
  PLAYER = "PLAYER",
}
export enum Status {
  INACTIVE = "INACTIVE",
  ACTIVE = "ACTIVE",
}
export interface IAuth {
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
}


export type UpdateUserInputDTO = {
  id: number; //TODO: migrate the type as string
  username?: string;
  teamname?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  role?: Role;
  country: {
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

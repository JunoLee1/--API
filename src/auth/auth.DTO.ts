export type LoginInput = {
  email: string;
  password: string;
};
export type signUpSevicePasswordDto = {
  hashedPassword: string
};
export type PhoneNumberDTO = {
  encrypted: string
  iv: string
}
export type signUpInputServiceDto = {
  email: string;
  password: string;
  username: string;
  nickname: string;
  phoneNumber:PhoneNumberDTO
  countriesId: number;
};
export type signUpInputDto = {
  email: string;
  password: string;
  confirmedPassword: string;
  username: string;
  nickname: string;
  phoneNumber:string
  countriesId: number;
};
export type signUpOutputDto = {
  email: string;
  password: string;
  username: string;
  nickname: string;
  //phoneNumber:string
  countriesId: number;
};
export type Pagenation = {
  take: number;
  page: number;
};
export type NameType = {
  username: string | undefined;
  teamname: string | undefined;
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
  ACTIVE = "ACTIVE"
}
export interface IAuth {
  id: number; // should change to string
  username: string;
  teamname: string;
  email: string;
  password: string;
  //phoneNumber:string
  role: Role;
  country: string;
  isDeleted?:boolean;
  status?:Status
}
export type UpdatedUserStatusDTO = {
    id:number,
    status:Status
}[]
export type LoginOutput = {
  accessToken: string;
  refreshToken: string;
};
export type paramsType = {
  id: number;
};


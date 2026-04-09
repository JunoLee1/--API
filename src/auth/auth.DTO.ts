export type LoginInput = {
  email: string;
  password: string;
};
export type signUpInputDto = {
  email: string;
  password: string;
  confirmedPassword: string;
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
export interface IAuth {
  id: number; // should change to string
  username: string;
  teamname: string;
  email: string;
  password: string;
  //phoneNumber:string
  role: Role;
  country: string;
  isDeleted?:boolean
}
export type LoginOutput = {
  accessToken: string;
  refreshToken: string;
};
export type paramsType = {
  id: number;
};


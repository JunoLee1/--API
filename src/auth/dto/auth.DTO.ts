
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
  nickname:string
  team:{
    id:number,
    team_name:string
  };
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


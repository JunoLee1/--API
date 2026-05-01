
export type ParamsDto = {
  id: number;
};

export type SignUpInputDto = {
  email: string;
  password: string;
  confirmedPassword: string;
  username: string;
  nickname: string;
   team:{
    id:number,
    name:string
  }
  phoneNumber: string;
  date_of_birth: Date;
  nationality: {
    id: number;
    name: string;
    code: string;
  };
};

export type QueryType = {
    take: Pagination;
    page: Pagination;
    username: string | null;
    teamname:string | null

}
type Pagination = {
  take: number;
  page: number;
};

export type LoginInput = {
  email: string;
  password: string;
};
export type SignUpOutputDto = {
  email: string;
  username: string;
  nickname: string;
};


export type paramsType = {
  id: number;
};

export type signUpInputDto = {
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
  country: {
    id: number;
    name: string;
    code: string;
  };
};

export type QueryType = {
    take: Pagenation;
    page: Pagenation;
    username: string | null;
    teamname:string | null

}
type Pagenation = {
  take: number;
  page: number;
};

export type LoginInput = {
  email: string;
  password: string;
};
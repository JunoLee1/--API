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
  email: string;
  password: string;
  confirmedPassword:string,
  username: string;
  nickname: string;
  date_of_birth: Date;
  phoneNumber: string;
  team:{
    id:number,
    name:string
  }
  country: {
    id: number;
    name: string;
    code: string;
  };
};

export type LoginOutputServiceDto = {
  accessToken: string;
  refreshToken: string;
};
export type findAdvisorsServiceDto = {
    skip:number,
    take:number,
    username:string| null,
    teamname:string| null
}
export type findAdvisorsOutPutDto = {
    username: string | null ,
    teamname:string | null,
    email:string,
    nickname:string
}[]
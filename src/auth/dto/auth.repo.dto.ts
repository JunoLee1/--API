import { encryptedPhoneNumberType } from "./auth.service.dto";

export type SignUpInputRepoDto = {
  email: string;
  password: string;
  username: string;
  nickname: string;
  date_of_birth: Date;
  phoneNumber: encryptedPhoneNumberType;
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
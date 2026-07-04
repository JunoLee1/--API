import { Role } from "../../generated/enums";

export type LoginInputServiceDto = {
  email: string;
  password: string;
};

export type EncryptedPhoneNumberType = {
  encrypted: string;
  iv: string;
};

export type SignUpInputServiceDto = {
  email: string;
  password: string;
  confirmedPassword: string;
  username: string;
  nickname: string;
  dateOfBirth: Date;
  phoneNumber: string;
  nationality: {
    code: string;
  };
  role: Role;
};

export type LoginOutputServiceDto = {
  accessToken: string;
  refreshToken: string;
};

export type FindAdvisorsServiceDto = {
  skip: number;
  take: number;
  username: string | null;
};

export type FindAdvisorsOutputDto = {
  email: string;
  username: string;
  nickname: string;
}[];

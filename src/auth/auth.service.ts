import { AuthRepository } from "./auth.repo";
import { generateToken } from "../lib/token";
import { hashedPassword, match } from "../lib/hash";
import CountryService from "../country/country.service";
import { encrypt } from "../lib/crypto"
import { IAuth } from "./dto/auth.DTO";

import {
  FindAdvisorsServiceDto,
  SignUpInputServiceDto,
  LoginInputServiceDto,
  LoginOutputServiceDto,
  FindAdvisorsOutputDto,
  UpdatedUserStatusDTO,
} from "./dto/auth.service.dto";
import { User } from "../generated/client";
import { AppError } from "../lib/appError";
import { SignUpOutputDto } from "./dto/auth.repo.dto";
//import  prisma from "../lib/prisma"
export default class AuthService {
  constructor(
    private repo: AuthRepository,
    private countryService: CountryService,
  ) {}
  async signUp({
    email,
    password,
    nickname,
    username,
    nationality,
    confirmedPassword,
    team,
    role,
    phoneNumber,
    date_of_birth,
  }: SignUpInputServiceDto): Promise<SignUpOutputDto>  {
    
    if (!email) {
      throw new AppError(400,"INVALID_EMAIL");
    }
     
    if (!nickname) {
      throw new AppError(400,"INVALID_NICKNAME");
    }
     
    if (!password) {
      throw new AppError(400,"INVALID_PASSWORD");
    }
     
    const duplicatedEmail = await this.repo.isEmailDuplicated(email);
    if (duplicatedEmail) {
      throw new AppError (409,"DUPLICATED_EMAIL");
    }

    const countryCodeChecker = await this.countryService.getCountryByCode(
      nationality.code,
    );
    if (!countryCodeChecker) throw new AppError(400,"INVALID_NATIONALITY_CODE");

    const duplicatedNickname = await this.repo.isNicknameDuplicated(nickname);
    if (duplicatedNickname) {
      throw new AppError(409,"DUPLICATED_NICKNAME");
    }

    if (password !== confirmedPassword) {
      throw new AppError(400,"PASSWORD_NOT_MATCH");
    }
    
    const hashPassword = await hashedPassword(password);

    const encryptedPhonenumber = await encrypt(phoneNumber);
    const phoneNumberChecker = await this.repo.isDuplicatedPhoneNumber(encryptedPhonenumber.encrypted)
    if( phoneNumberChecker ) {
      throw new AppError(409,"DUPLICATED PHONENUMBER")
    }
    const newAdmin = await this.repo.createAdmin({
      email,
      password: hashPassword,
      nickname,
      username,
      team,
      role,
      date_of_birth,
      nationality,
      phoneNumber: encryptedPhonenumber,
    });
    return {
      email: newAdmin.email,
      username:newAdmin.username,
      nickname:newAdmin.nickname,
      date_of_birth:newAdmin.date_of_birth,
      team:{
        id: newAdmin.team.id,
        teamname: newAdmin.team.teamname
      },
      nationality:{
        id: newAdmin.nationality.id,
        name: newAdmin.nationality.name,
        code: newAdmin.nationality.code,
      },
      role:newAdmin.role,
    };
  }

  //=================================================================================================================================================================================
  async login({
    email,
    password,
  }: LoginInputServiceDto): Promise<LoginOutputServiceDto> {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new AppError(400,"INVALID USER EMAIL");

    const isMatched = await match(password,user.password);
    if (!isMatched) throw new AppError(400,"Wrong Password");
    const { accessToken, refreshToken } = await generateToken(user.id, user.role);
    return { accessToken, refreshToken };
  }
  //=================================================================================================================================================================================

  async findAdvisorById(id: number) {
    const user = await this.repo.findAdvisorById(id);
    if (!user) {
      throw new AppError(404,"NOT FOUND");
    }
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      teamname: user.team.teamname,
    };
  }
  //=================================================================================================================================================================================
  async findAdvisors({
    take,
    skip,
    team,
    username,
  }: FindAdvisorsServiceDto): Promise<FindAdvisorsOutputDto> {
    const where: any = {};
    if (team) {
      where.teamname= team.teamname;
    }

    if (username) {
      where.username = username;
    }
    const advisors = await this.repo.findAdvisors({
      where,
      include: {
        team: true,
      },
      take,
      skip,
    });
    const result = advisors.map((a) => ({
      email: a.email,
      username: a.username,
      teamname: a?.team?.teamname ?? null,
      nickname: a.nickname,
    }));
    return result;
  }
  //=================================================================================================================================================================================

  async updatesAdvisor(data:any) {
    const {
      id,
      email,
      team,
      username,
      password,
      nationality,
      role,
      phoneNumber,
      nickname,
      isDeleted
    } = data;

    const advisorId = await this.repo.findAdvisorById(id);
    if (!advisorId) throw new AppError(404, "NOT FOUND");
    const updatedData: any = {};
    if (email !== undefined) updatedData.email = email;
    if (username !== undefined) updatedData.username = username;
    if (nickname !== undefined) updatedData.nickname = nickname;
    if (password !== undefined) updatedData.password = password;
    if (role !== undefined) updatedData.role = role;
    if (team !== undefined) updatedData.teamId = team.id;
    if (nationality !== undefined) updatedData.nationality = nationality;
    if (phoneNumber !== undefined) updatedData.phoneNumber = phoneNumber;
    if(isDeleted!== undefined) updatedData.isDeleted = isDeleted
    const admin = await this.repo.updatesAdvisor(id,updatedData);
    const result = {
      id: admin.id,
      email:admin.email,
      date_of_birth:admin.date_of_birth,
      password:admin.password,
      nickname:admin.nickname,
      role:admin.role,
      isDeleted:admin.isDeleted,
      phoneNumber:admin.phoneNumber,
      username:admin.username,
      team: admin.team,
      nationality: admin.nationality
    }
    return result;
  }
  //=================================================================================================================================================================================
  async updateAdvisorsStatus(data: UpdatedUserStatusDTO) {
    
    const ids = data.map((item) => item.id);
    const users: User[] = await this.repo.findAdvisorsByIds(ids);
    if (users.length === 0) throw new AppError (400, "Invalid adminstrators");
    const validIds = users.map(u => u.id);
    const filtered = data.filter(item=> validIds.includes(item.id));
    const result = await this.repo.updateAdvisorStatus(filtered);
    return result;
  }
  //=================================================================================================================================================================================
  async delete(id: number) {
    const user = await this.repo.findAdvisorById(id);
    if (!user) throw new AppError(404,"NOT FOUND");

    if (user.isDeleted === true) {
      return await this.repo.delete(id);
    }
    return await this.repo.updatesAdvisor(id, { isDeleted: true });
  }
  //=================================================================================================================================================================================
  async deleteMany(data: { id: number }[]) {
    const ids = data.map((item) => item.id);
    const users: User[] = await this.repo.findAdvisorsByIds(ids);
    if (!users.length) throw new AppError(404, "NOT FOUND");

    const activeUserIds = users.filter((user) => !user.isDeleted).map(user => 
      user.id
    )
    if (!activeUserIds) return[]
    return await this.repo.deleteMany({
      ids: activeUserIds,
      isDeleted:true,
    });
  }
}

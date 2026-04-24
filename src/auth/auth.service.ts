import { AuthRepository } from "./auth.repo";
import { generateToken } from "../lib/token";
import { hashedPassword, match } from "../lib/hash";
import CountryService from "../country/country.service";
import { encrypt } from "../lib/crypto"
import { IAuth } from "./dto/auth.DTO";

import {
  findAdvisorsServiceDto,
  signUpInputServiceDto,
  LoginInputServiceDto,
  LoginOutputServiceDto,
  findAdvisorsOutPutDto,
  UpdatedUserStatusDTO,
} from "./dto/auth.service.dto";
import { User } from "../generated/client";
//import  prisma from "../lib/prisma"
export default class AuthService {
  constructor(
    private repo: AuthRepository,
    private countryService: CountryService,
  ) {}
  async signUp({
    email,
    password,
    confirmedPassword,
    nickname,
    username,
    country,
    team,
    phoneNumber,
    date_of_birth,
  }: signUpInputServiceDto) {
    if (!email) {
      throw new Error("INVALID_EMAIL");
    }
    if (!nickname) {
      throw new Error("INVALID_NICKNAME");
    }
    if (!password) {
      throw new Error("INVALID_PASSWORD");
    }
    const duplicatedEmail = await this.repo.isEmailDuplicated(email);
    if (duplicatedEmail) {
      throw new Error("DUPLICATED_EMAIL");
    }
    const countryCodeChecker = await this.countryService.getCountryByCode(
      country!.code,
    );
    if (!countryCodeChecker) throw new Error("국적을 선택해주세요.");

    const duplicatedNickname = await this.repo.isNicknameDuplicated(nickname);
    if (duplicatedNickname) {
      throw new Error("DUPLICATED_NICKNAME");
    }

    if (password !== confirmedPassword) {
      throw new Error("PASSWORD_NOT_MATCH");
    }
    const hashPassword = await hashedPassword(password);

    const encryptedPhonenumber = await encrypt(phoneNumber);
    const result = await this.repo.createAdmin({
      email,
      password: hashPassword,
      nickname,
      username,
      team,
      date_of_birth,
      country,
      phoneNumber: encryptedPhonenumber,
    });
    return result;
  }

  //=================================================================================================================================================================================
  async login({
    email,
    password,
  }: LoginInputServiceDto): Promise<LoginOutputServiceDto> {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new Error("INVALID USER EMAIL");

    const u_password = await hashedPassword(password)
    const isMatched = await match(u_password, user.password);
    if (!isMatched) throw new Error("Wrong Password");
    
    const { accessToken, refreshToken } = await generateToken(user.id);
  
    return { accessToken, refreshToken };
  }
  //=================================================================================================================================================================================

  async findAdvisorById(id: number) {
    const user = await this.repo.findAdvisorById(id);
    console.log(user);
    if (!user) {
      throw new Error("NOT FOUND");
    }
    console.log("team_name:", user.team.team_name);
    return {
      id: user.id,
      username: user.username,
      email: user.email,

      teamname: user.team.team_name,
    };
  }
  //=================================================================================================================================================================================
  async findAdvisors({
    take,
    skip,
    teamname,
    username,
  }: findAdvisorsServiceDto): Promise<findAdvisorsOutPutDto> {
    const where: any = {};
    if (teamname) {
      where.teamname = teamname;
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
      teamname: a.team.team_name ?? null,
      nickname: a.nickname,
    }));
    return result;
  }
  //=================================================================================================================================================================================

  async updatesAdvisor(data: IAuth) {
    const {
      id,
      email,
      teamname,
      username,
      password,
      country,
      role,
      phoneNumber,
    } = data;

    const advisorId = await this.repo.findAdvisorById(id);
    if (!advisorId) throw new Error("NOT FOUND");
    const updatedData: any = {};
    if (email !== undefined) updatedData.email = email;
    if (username !== undefined) updatedData.username = username;
    if (password !== undefined) updatedData.password = password;
    if (role !== undefined) updatedData.role = role;
    if (country !== undefined) updatedData.country = country;
    if (phoneNumber !== undefined) updatedData.phoneNumber = phoneNumber;
    const result = await this.repo.updatesAdvisor(id, updatedData);
    return result;
  }
  //=================================================================================================================================================================================
  async updateAdvisorsStatus(data: UpdatedUserStatusDTO) {
    const ids = data.map((item) => item.id);
    const users: User[] = await this.repo.findAdvisorsByIds(ids);
    if (users.length === 0) throw new Error("Invalid adminstrators");
    const validIds = users.map((u) => u.id);
    const fitered = data.filter((item) => validIds.includes(item.id));
    const result = await this.repo.updateAdvisorStatus(fitered);
    return result;
  }
  //=================================================================================================================================================================================
  async delete(id: number) {
    const user = await this.repo.findAdvisorById(id);
    if (!user) throw new Error("NOT FOUND");

    if (user.isDeleted === true) {
      return await this.repo.delete(id);
    }
    return await this.repo.updatesAdvisor(id, { isDeleted: true });
  }
  //=================================================================================================================================================================================
  async deleteMany(data: { id: number }[]) {
    const ids = data.map((item) => item.id);
    const users: User[] = await this.repo.findAdvisorsByIds(ids);
    if (!users.length) throw new Error("NOT FOUND");

    const activeUsers = users.filter((user) => !user.isDeleted);
    const updated = activeUsers.map((user) => ({
      ...user,
      isDeleted: true,
    }));
    return await this.repo.updateAdvisorStatus({
      ids: activeUsers.map((u) => u.id),
      isDeleted: true,
    });
  }
}

import { AuthRepository } from "./auth.repo";
import { generateToken } from "../lib/token";
import { hashedPassword, match} from "../lib/hash";
import { encrypt} from "../lib/crypto";
import {
  signUpInputDto,
  LoginInput,
  LoginOutput,
  Pagenation,
  NameType,
  IAuth,
  UpdatedUserStatusDTO,
} from "./auth.DTO";
import { User } from "../generated/prisma/client";
//import  prisma from "../lib/prisma"
export default class AuthService {
  constructor(private repo: AuthRepository) {}
  async signUp({
    email,
    password,
    confirmedPassword,
    nickname,
    username,
    countriesId,
    phoneNumber
  }: signUpInputDto) {
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
    const duplicatedNickname = await this.repo.isNicknameDuplicated(nickname);
    if (duplicatedNickname) {
      throw new Error("DUPLICATED_NICKNAME");
    }

    if (password !== confirmedPassword) {
      throw new Error("PASSWORD_NOT_MATCH");
    }
    const hashPassword = await hashedPassword(password);

    
    const encryptedPhonenumber  = await encrypt(phoneNumber)
    const result = await this.repo.createAdmin({
      email,
      password: hashPassword,
      nickname,
      username,
      countriesId,
      phoneNumber:encryptedPhonenumber
    });
    return result;
  }

  //=================================================================================================================================================================================
  async login({ email, password }: LoginInput): Promise<LoginOutput> {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new Error("INVALID USER EMAIL");
    const isMatched = await match(password, user.password)
    if(!isMatched) throw new Error("Wrong Password")
    const { accessToken, refreshToken } = await generateToken(user.id);

    return { accessToken, refreshToken };
  }
  //=================================================================================================================================================================================

  async findAdvisorById(id: number) {
    const user = await this.repo.findAdvisorById(id);

    if (!user) {
      throw new Error("NOT FOUND");
    }
    return user;
  }

  //=================================================================================================================================================================================
  async findAdvisors(
    { take, page }: Pagenation,
    { teamname, username }: NameType,
  ) {
    const where: any = {};
    if (teamname) {
      where.teamname = teamname;
    }

    if (username) {
      where.username = username;
    }
    const advisors = await this.repo.findAdvisors({
      where,
      take,
      page,
    });
    return advisors;
  }
  //=================================================================================================================================================================================

  async updatesAdvisor(data: IAuth) {
    const { id, email, teamname, username, password, country, role } = data;
    const advisor = await this.repo.findAdvisorById(id);
    if (!advisor) throw new Error("NOT FOUND");
    const result = await this.repo.updatesAdvisor(data);
    return result;
  }
  //=================================================================================================================================================================================
  async updateAdvisorsStatus(data: UpdatedUserStatusDTO) {
    const ids = data.map((item) => item.id);
    const users: User[] = await this.repo.findAdvisorsByIds(ids);
    if (users.length === 0) throw new Error("Invalid adminstrators");
    const validIds = users.map((u) => u.id);
    const fitered = data.filter((item) => validIds.includes(item.id));
    const result = await this.repo.updateAdvisorsStatus(fitered);
    return result;
  }
  //=================================================================================================================================================================================
  async delete(id: number) {
    const user = await this.repo.findAdvisorById(id);
    if (!user) throw new Error("NOT FOUND");

    if (user.isDeleted === true) {
      return await this.repo.delete(id);
    }
    return await this.repo.updatesAdvisor({ id, isDeleted: true });
  }
  //=================================================================================================================================================================================
  async deleteMany(data: { id: any }[]) {
    const ids = data.map((item) => item.id);
    const users: User[] = await this.repo.findAdvisorsByIds(ids);
    if (!users.length) throw new Error("NOT FOUND");

    const activeUsers = users.filter((user) => !user.isDeleted);
    const updated = activeUsers.map((user) => ({
      ...user,
      isDeleted: true,
    }));
    return await this.repo.updateAdvisorsStatus({
      ids: activeUsers.map((u) => u.id),
      isDeleted: true,
    });
  }
}

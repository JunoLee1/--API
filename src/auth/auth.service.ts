import AuthRepo from "./auth.repo";
import { generateToken } from "../lib/token"
import { LoginInput } from "./auth.DTO";
//import bcrypt  from "bcrypt";
export default class AuthService {
  constructor(private repo: AuthRepo = new AuthRepo()) {}
  async signUp({ email, password, confirmPassword, nickname }: any) {
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
    if (password !== confirmPassword) throw new Error("PASSWORD_NOT_MATCH");
    
  }
  //=================================================================================================================================================================================
  async login({email, password }:LoginInput) {
    const user = await this.repo.findUniqueEmail(email);

    if (user === null) throw new Error("NOT FOUND");
  
    if (password !== user.password )throw new Error("Wrong Password");
   
    const {accessToken, refreshToken}  = await generateToken(user.id)
  
    return { accessToken ,refreshToken}
  }
  //=================================================================================================================================================================================
  async findAdvisorById(id: any) {
    const isExistingAdvisor = await this.repo.findAdvisorById(id)

    if (isExistingAdvisor === null){
        throw new Error("NOT FOUND")
    }
    return isExistingAdvisor
  }
  //=================================================================================================================================================================================
  async findAdvisors() {}
  //=================================================================================================================================================================================
  async update() {}
  //=================================================================================================================================================================================
  async delete() {}
}

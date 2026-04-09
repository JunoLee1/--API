import AuthRepo from "./auth.repo";
import { generateToken } from "../lib/token";
import { signUpInputDto, LoginInput, LoginOutput, Pagenation, NameType, IAuth } from "./auth.DTO";
import  prisma from "../lib/prisma"

//import bcrypt  from "bcrypt";
export default class AuthService {
  constructor(private repo: AuthRepo = new AuthRepo(prisma)) {}
  async signUp({ email, password, confirmedPassword, nickname }: signUpInputDto) {
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
    if (password !== confirmedPassword) throw new Error("PASSWORD_NOT_MATCH"); //TODO: hash password
    //TODO: 휴대폰번호 중복검사후 암호화해서 저장하기
  }
 
  //=================================================================================================================================================================================
  async login({ email, password }: LoginInput):Promise<LoginOutput> {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new Error("INVALID USER EMAIL");

    if (password !== user.password) throw new Error("Wrong Password");

    const { accessToken, refreshToken } = await generateToken(user.id);

    return { accessToken, refreshToken };
  }
  //=================================================================================================================================================================================
  
  async findAdvisorById(id: number){
    //TODO: TYPE CONVERT
    const user = await this.repo.findAdvisorById(id);

    if (user === null) {
      throw new Error("NOT FOUND");
    }
    return user;
  }
  
  //=================================================================================================================================================================================
  async findAdvisors({ take, page }:Pagenation, {teamname, username}:NameType) {
    const where: any = {};//TODO: TYPE CONVERT
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
  
  async updatesAdvisor(data:IAuth) {
    const {id, email, teamname, username, password, country, role} = data
    const advisor = await this.repo.findAdvisorById(id)
    if (!advisor) throw new Error("NOT FOUND");
    const result = await this.repo.updatesAdvisor(id,data)
    return result
  }
  //=================================================================================================================================================================================
  async updateAdvisorsStatus(data:{id: number, status:string}[]) {
    const ids = data.map(item => item.id)
    const users = await this.repo.findAdvisorsByIds(ids)
    if(users.length === 0) throw new Error("Invalid adminstrators");
    
    const validIds = users.map(u =>u.id)
    const fitered = data.filter(item => validIds.includes(item.id))
    const result = await this.repo.updateAdvisorsStatus(fitered)
    return result
  }
  //=================================================================================================================================================================================
  async delete(id:any) {
    
    const user = await this.repo.findAdvisorById(id)
    if(!user) throw new Error("NOT FOUND")
    
    if(user.isDeleted === true){
      return await this.repo.delete(id)
    }
   return await this.repo.updatesAdvisor(id,{ isDeleted:true})
  }
  //=================================================================================================================================================================================
  async deleteMany(data:{id:any}[]) {
    const ids = data.map(item=> item.id)
    const users = await this.repo.findAdvisorsByIds(ids)
    if(!users.length) throw new Error("NOT FOUND")

      const activeUsers = users.filter(user => !user.isDeleted);
      const updated = activeUsers.map(user => ({
        ...user,
        isDeleted: true
    }))
    return await this.repo.updateAdvisorsStatus({
      ids: activeUsers.map(u => u.id),
      isDeleted: true,
    })
  }
}

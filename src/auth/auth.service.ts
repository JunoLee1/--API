import AuthRepo from"./auth.repo"
//import bcrypt  from "bcrypt";
export default class AuthService {
    constructor(
        private repo : AuthRepo = new AuthRepo()
    ){}
    async create({email, password,confirmPassword, nickname}:any){
        if (!email) {
            throw new Error("INVALID_EMAIL")
        }
        if (!nickname) {
            throw new Error("INVALID_NICKNAME")
        }
        if(!password) {
            throw new Error("INVALID_PASSWORD")
        }
        const duplicatedEmail = await this.repo.isEmailDuplicated(email)
        if (duplicatedEmail) {
            throw new Error("DUPLICATED_EMAIL")
        }
        const duplicatedNickname = await this.repo.isNicknameDuplicated(nickname)
        if (duplicatedNickname){
            throw new Error("DUPLICATED_NICKNAME")
        }
        if (password !== confirmPassword) throw new Error("PASSWORD_NOT_MATCH")
       return {email, password, nickname}
    }

    async accessAdvisor(){}

    async accessAdvisors(){}

    async update(){}

    async delete(){}

}
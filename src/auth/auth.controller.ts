import AuthService from "./auth.service"
export default class AuthController {
    constructor(
        private service : AuthService 
    ){}
    async create(req: any, res:any){
        try{
            const result = await this.service.create(req.body)
            return res.status(201).json(result)
        }catch(error:any){
            return res.status(400).json({ message:"Something Wrong" })
        }
    }

    accessAdvisor(req:any, res: any){}

    accessAdvisors(){}

    update(){}

    delete(){}

} 


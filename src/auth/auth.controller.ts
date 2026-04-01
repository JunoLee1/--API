import AuthService from "./auth.service"
export default class AuthController {
    constructor(
        private service : AuthService 
    ){}
    async create(req: any, res:any){
        console.log(1)
        const result = await this.service.create(req.body)
         console.log(12)
        return res.status(201).json(result)
       
    }

    accessAdvisor(){}

    accessAdvisors(){}

    update(){}

    delete(){}

} 


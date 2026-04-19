import {Router} from "express"
import userAPI from "./auth/auth.routes"
const router = Router()

//유저 CRUD (/users)
router.use("/users",userAPI)

//시즌 CRUD (/api/seasons)
//경기 CRUD (/api/matches)
//선수 CRUD (/api/players)
export default router
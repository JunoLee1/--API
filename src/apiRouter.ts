import {Router} from "express"
import userAPI from "./auth/auth.routes"
import countryAPI from "./country/country.routes"
const router = Router()

router.get("/", (req, res) => {
  res.status(200).json({ message: "API OK" });
});
//유저 CRUD (/users)

router.use("/users",userAPI)

// country CRUD
router.use("/country", countryAPI)
//시즌 CRUD (/api/seasons)
//경기 CRUD (/api/matches)
//선수 CRUD (/api/players)
export default router
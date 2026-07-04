import {Router} from "express"
import userAPI from "./auth/auth.routes"
import countryAPI from "./country/country.routes"
import playerAPI from "./player/player.routes"
const router = Router()

router.get("/", (req, res) => {
  res.status(200).json({ message: "API OK" });
});

router.use("/users", userAPI)
router.use("/country", countryAPI)
router.use("/players", playerAPI)

//시즌 CRUD (/api/seasons)
//경기 CRUD (/api/matches)
export default router
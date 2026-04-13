import router from "../index"
import Controller from "./country.controller"
const controller = new Controller()
router.get(
    "/:code",
    controller.getCountry
)
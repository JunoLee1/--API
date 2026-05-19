import express  = require("express")
import * as dotenv from "dotenv";
import router from "./app";

dotenv.config();

const PORT = process.env.PORT
const app = express()

app.use("/api", router);
app.listen(PORT, () => {
    console.log(`server is running`)
})

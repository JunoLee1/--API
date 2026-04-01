import express  = require("express")
import APIRouter from "./index.js"
import cors  = require("cors")
import * as dotenv from "dotenv";
import cookieParser = require("cookie-parser")

dotenv.config();

const PORT = process.env.PORT
const app = express()

app.use(cookieParser())

app.use(express.json())
app.use(cors({
    origin: PORT ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
})
)

app.use("/api", APIRouter)

app.listen(PORT, () => {
    console.log(`server is running`)
})

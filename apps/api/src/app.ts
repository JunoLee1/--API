import express  = require("express")
import cookieParser = require("cookie-parser")
import APIRouter from "./apiRouter"
import cors  = require("cors")
import * as dotenv from "dotenv";
import { errorHandler } from "./middleWare/ErrorHandler";

dotenv.config()
const PORT = process.env.PORT || '5000';
const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(
    cors({
        origin: PORT ?? "http://localhost:5175",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials: true
    })
)
app.use("/api", APIRouter)
app.use(errorHandler); 

export default app
import express  = require("express")
import cookieParser = require("cookie-parser")
import APIRouter from "./apiRouter"
import cors  = require("cors")
import * as dotenv from "dotenv";
import { errorHandler } from "./middleWare/ErrorHandler";
import webhookRouter from "./webhook/webhook.routes";

dotenv.config()
const PORT = process.env.PORT || '5000';
const app = express()
app.use(cookieParser())
app.use(
    cors({
        origin: PORT ?? "http://localhost:5175",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials: true
    })
)
app.use("/webhooks", express.raw({ type: "application/json" }), webhookRouter)
app.use("/api", express.json(), APIRouter)
app.use(errorHandler);

export default app
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import passport from "./lib/strategy";
import apiRouter from "./apiRouter";
import { AppError } from "./lib/appError";
import { Request, Response, NextFunction } from "express";

const app = express();

app.use(cors({ origin: process.env["CLIENT_ORIGIN"], credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api", apiRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ code: "INTERNAL_SERVER_ERROR" });
});

const PORT = process.env["PORT"] ?? 3001;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));

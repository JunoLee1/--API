import { Router } from "express";
import authRouter from "./auth/auth.routes";
import contractRouter from "./contract/contract.routes";
import injuryRouter from "./injury/injury.routes";
import matchRouter from "./match/match.routes";
import notificationRouter from "./notification/notification.routes";
import playerRouter from "./player/player.routes";
import seasonRouter from "./season/season.routes";
import tacticalRouter from "./tactical/tactical.routes";
import trainingRouter from "./training/training.routes";
import transferRouter from "./transfer/transfer.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/contracts", contractRouter);
apiRouter.use("/injuries", injuryRouter);
apiRouter.use("/matches", matchRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/players", playerRouter);
apiRouter.use("/seasons", seasonRouter);
apiRouter.use("/tactical", tacticalRouter);
apiRouter.use("/training", trainingRouter);
apiRouter.use("/transfers", transferRouter);

export default apiRouter;

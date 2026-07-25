CREATE TABLE "PlayerSecondaryPosition" (
  "id"            SERIAL           PRIMARY KEY,
  "playerId"      TEXT             NOT NULL,
  "position"      "Position"       NOT NULL,
  "fitnessTarget" DOUBLE PRECISION NOT NULL,
  "createdAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerSecondaryPosition_playerId_position_key" UNIQUE ("playerId", "position"),
  CONSTRAINT "PlayerSecondaryPosition_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CoachingStaffEvaluation" (
  "id"          SERIAL       PRIMARY KEY,
  "staffUserId" INTEGER      NOT NULL,
  "evaluatorId" INTEGER      NOT NULL,
  "score"       INTEGER      NOT NULL,
  "comment"     TEXT,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachingStaffEvaluation_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoachingStaffEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

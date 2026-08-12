CREATE TABLE IF NOT EXISTS "FormationSnapshot" (
  "id"             SERIAL PRIMARY KEY,
  "matchId"        INTEGER NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
  "minute"         INTEGER,
  "formation"      TEXT NOT NULL,
  "changeReason"   TEXT,
  "createdById"    INTEGER NOT NULL REFERENCES "User"("id"),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "RefreshTokenBlacklist" (
    "jti"       TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshTokenBlacklist_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX "RefreshTokenBlacklist_expiresAt_idx" ON "RefreshTokenBlacklist"("expiresAt");

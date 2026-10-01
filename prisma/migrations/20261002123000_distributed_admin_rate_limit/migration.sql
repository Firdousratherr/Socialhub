CREATE TABLE "AdminLoginAttempt" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminLoginAttempt_key_key" ON "AdminLoginAttempt"("key");
CREATE INDEX "AdminLoginAttempt_resetAt_idx" ON "AdminLoginAttempt"("resetAt");
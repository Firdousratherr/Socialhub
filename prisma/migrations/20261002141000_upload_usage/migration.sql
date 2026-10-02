CREATE TABLE "UploadUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UploadUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UploadUsage_userId_createdAt_idx"
  ON "UploadUsage"("userId","createdAt");
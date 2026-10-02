ALTER TABLE "User"
  ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ownerSince" TIMESTAMP(3);

CREATE TYPE "VerificationAuditAction" AS ENUM ('GRANTED', 'REVOKED', 'OWNER_GRANTED', 'OWNER_REVOKED');

CREATE TABLE "VerificationAudit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" "VerificationAuditAction" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationAudit_userId_createdAt_idx" ON "VerificationAudit"("userId", "createdAt");
CREATE INDEX "VerificationAudit_adminId_createdAt_idx" ON "VerificationAudit"("adminId", "createdAt");

ALTER TABLE "VerificationAudit"
  ADD CONSTRAINT "VerificationAudit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationAudit"
  ADD CONSTRAINT "VerificationAudit_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

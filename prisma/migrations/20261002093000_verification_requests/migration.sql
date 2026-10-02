-- Verification request workflow
CREATE TYPE "VerificationRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "VerificationRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationRequest_userId_status_createdAt_idx" ON "VerificationRequest"("userId", "status", "createdAt");
CREATE INDEX "VerificationRequest_status_createdAt_idx" ON "VerificationRequest"("status", "createdAt");

ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
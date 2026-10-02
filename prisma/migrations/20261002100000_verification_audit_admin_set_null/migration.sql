ALTER TABLE "VerificationAudit" DROP CONSTRAINT IF EXISTS "VerificationAudit_adminId_fkey";
ALTER TABLE "VerificationAudit" ALTER COLUMN "adminId" DROP NOT NULL;
ALTER TABLE "VerificationAudit" ADD CONSTRAINT "VerificationAudit_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
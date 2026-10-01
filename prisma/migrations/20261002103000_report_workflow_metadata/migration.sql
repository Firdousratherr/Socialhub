CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TABLE "Report"
  ADD COLUMN "priority" "ReportPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "moderatorNote" TEXT;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Report_assignedToId_status_priority_createdAt_idx"
  ON "Report"("assignedToId","status","priority","createdAt");

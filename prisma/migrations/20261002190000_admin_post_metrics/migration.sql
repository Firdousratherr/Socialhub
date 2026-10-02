ALTER TYPE "AdminPermissionKey" ADD VALUE IF NOT EXISTS 'STORAGE_MANAGE';
ALTER TYPE "AdminPermissionKey" ADD VALUE IF NOT EXISTS 'CONTENT_METRICS';

-- Add post-level administrative display metric overrides.
CREATE TABLE IF NOT EXISTS "AdminPostMetricOverride" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "likes" INTEGER,
  "comments" INTEGER,
  "shares" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminPostMetricOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminPostMetricOverride_postId_key" ON "AdminPostMetricOverride"("postId");
CREATE INDEX IF NOT EXISTS "AdminPostMetricOverride_updatedAt_idx" ON "AdminPostMetricOverride"("updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AdminPostMetricOverride_postId_fkey'
  ) THEN
    ALTER TABLE "AdminPostMetricOverride"
      ADD CONSTRAINT "AdminPostMetricOverride_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

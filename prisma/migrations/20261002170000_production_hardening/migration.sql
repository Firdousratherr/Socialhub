-- Production hardening: lifecycle, profile analytics, storage metadata, admin relations and generic rate limits

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "forcePasswordResetAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminMetricOverride_userId_fkey'
      AND conrelid = '"AdminMetricOverride"'::regclass
  ) THEN
    ALTER TABLE "AdminMetricOverride"
      ADD CONSTRAINT "AdminMetricOverride_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminAuditLog_adminId_fkey'
      AND conrelid = '"AdminAuditLog"'::regclass
  ) THEN
    ALTER TABLE "AdminAuditLog"
      ADD CONSTRAINT "AdminAuditLog_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "UploadUsage"
  ADD COLUMN IF NOT EXISTS "url" TEXT,
  ADD COLUMN IF NOT EXISTS "pathname" TEXT,
  ADD COLUMN IF NOT EXISTS "mimeType" TEXT;

CREATE INDEX IF NOT EXISTS "UploadUsage_createdAt_bytes_idx" ON "UploadUsage"("createdAt","bytes");

CREATE TABLE IF NOT EXISTS "ProfileView" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "viewerId" TEXT,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProfileView_profileId_viewedAt_idx" ON "ProfileView"("profileId","viewedAt");
CREATE INDEX IF NOT EXISTS "ProfileView_viewerId_viewedAt_idx" ON "ProfileView"("viewerId","viewedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProfileView_profileId_fkey'
      AND conrelid = '"ProfileView"'::regclass
  ) THEN
    ALTER TABLE "ProfileView"
      ADD CONSTRAINT "ProfileView_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProfileView_viewerId_fkey'
      AND conrelid = '"ProfileView"'::regclass
  ) THEN
    ALTER TABLE "ProfileView"
      ADD CONSTRAINT "ProfileView_viewerId_fkey"
      FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RateLimitBucket_key_key" ON "RateLimitBucket"("key");
CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

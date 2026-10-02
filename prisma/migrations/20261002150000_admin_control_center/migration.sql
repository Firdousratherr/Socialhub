-- Admin control-center persistence
CREATE TYPE "AdminPermissionKey" AS ENUM ('USERS_VIEW','USERS_EDIT','USERS_SECURITY','USERS_BULK','CONTENT_VIEW','CONTENT_MODERATE','MESSAGES_VIEW','REPORTS_MANAGE','VERIFICATION_MANAGE','ANALYTICS_VIEW','AUDIT_VIEW','AUDIT_EXPORT','PLATFORM_SETTINGS','FEATURE_FLAGS','ANNOUNCEMENTS','STORAGE_VIEW','SECURITY_MANAGE','ADMIN_MANAGE','PRIVACY_OPERATIONS');

CREATE TABLE "AdminPermission" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "permission" "AdminPermissionKey" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminPermission_adminId_permission_key" ON "AdminPermission"("adminId","permission");
CREATE INDEX "AdminPermission_permission_idx" ON "AdminPermission"("permission");
ALTER TABLE "AdminPermission" ADD CONSTRAINT "AdminPermission_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE INDEX "SystemSetting_updatedById_idx" ON "SystemSetting"("updatedById");
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FeatureFlag" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");
CREATE INDEX "FeatureFlag_updatedById_idx" ON "FeatureFlag"("updatedById");
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" TEXT NOT NULL DEFAULT 'ALL',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Announcement_status_startsAt_idx" ON "Announcement"("status","startsAt");
CREATE INDEX "Announcement_createdById_createdAt_idx" ON "Announcement"("createdById","createdAt");
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

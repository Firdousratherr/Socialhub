ALTER TABLE "UserPrivacySetting"
  ADD COLUMN IF NOT EXISTS "showActiveStatus" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "PushDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'ANDROID',
  "provider" TEXT NOT NULL DEFAULT 'FCM',
  "appVersion" TEXT,
  "deviceName" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushDevice_token_key" ON "PushDevice"("token");
CREATE INDEX IF NOT EXISTS "PushDevice_userId_enabled_idx" ON "PushDevice"("userId","enabled");
CREATE INDEX IF NOT EXISTS "PushDevice_lastSeenAt_idx" ON "PushDevice"("lastSeenAt");

CREATE TABLE IF NOT EXISTS "Presence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'OFFLINE',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Presence_userId_key" ON "Presence"("userId");
CREATE INDEX IF NOT EXISTS "Presence_state_expiresAt_idx" ON "Presence"("state","expiresAt");

CREATE TABLE IF NOT EXISTS "RealtimeEvent" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "conversationId" TEXT,
  "entityId" TEXT,
  "payload" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RealtimeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RealtimeEvent_recipientId_createdAt_idx" ON "RealtimeEvent"("recipientId","createdAt");
CREATE INDEX IF NOT EXISTS "RealtimeEvent_recipientId_id_idx" ON "RealtimeEvent"("recipientId","id");
CREATE INDEX IF NOT EXISTS "RealtimeEvent_conversationId_createdAt_idx" ON "RealtimeEvent"("conversationId","createdAt");
CREATE INDEX IF NOT EXISTS "RealtimeEvent_createdAt_idx" ON "RealtimeEvent"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PushDevice_userId_fkey'
      AND conrelid = '"PushDevice"'::regclass
  ) THEN
    ALTER TABLE "PushDevice"
      ADD CONSTRAINT "PushDevice_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Presence_userId_fkey'
      AND conrelid = '"Presence"'::regclass
  ) THEN
    ALTER TABLE "Presence"
      ADD CONSTRAINT "Presence_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'RealtimeEvent_recipientId_fkey'
      AND conrelid = '"RealtimeEvent"'::regclass
  ) THEN
    ALTER TABLE "RealtimeEvent"
      ADD CONSTRAINT "RealtimeEvent_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "User" DROP COLUMN IF EXISTS "presenceId";
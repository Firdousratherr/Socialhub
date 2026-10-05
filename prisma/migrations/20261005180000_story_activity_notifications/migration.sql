-- Story activity notifications: replies and reactions/likes.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STORY_REPLY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STORY_REACTION';

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "storyId" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_storyId_idx"
  ON "Notification"("storyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_storyId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_storyId_fkey"
      FOREIGN KEY ("storyId") REFERENCES "Story"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "NotificationPreference"
  ADD COLUMN IF NOT EXISTS "storyReplies" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "storyReactions" BOOLEAN NOT NULL DEFAULT true;

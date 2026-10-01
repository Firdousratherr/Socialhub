ALTER TABLE "UserPrivacySetting"
  ADD COLUMN "showFollowersList" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showFollowingList" BOOLEAN NOT NULL DEFAULT true;

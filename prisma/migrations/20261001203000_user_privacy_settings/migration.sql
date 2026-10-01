CREATE TABLE "UserPrivacySetting" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "showFriendsList" BOOLEAN NOT NULL DEFAULT true,
  "allowMessagesEveryone" BOOLEAN NOT NULL DEFAULT true,
  "allowFriendRequests" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPrivacySetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserPrivacySetting_userId_key" ON "UserPrivacySetting"("userId");
ALTER TABLE "UserPrivacySetting" ADD CONSTRAINT "UserPrivacySetting_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

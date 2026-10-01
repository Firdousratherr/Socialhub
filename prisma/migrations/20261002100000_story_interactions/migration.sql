CREATE TABLE "StoryReply" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryReply_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoryReply_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoryReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StoryReply_storyId_createdAt_idx" ON "StoryReply"("storyId","createdAt");
CREATE INDEX "StoryReply_authorId_createdAt_idx" ON "StoryReply"("authorId","createdAt");

CREATE TABLE "StoryReaction" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryReaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoryReaction_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoryReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StoryReaction_storyId_userId_key" ON "StoryReaction"("storyId","userId");
CREATE INDEX "StoryReaction_storyId_createdAt_idx" ON "StoryReaction"("storyId","createdAt");
CREATE INDEX "StoryReaction_userId_createdAt_idx" ON "StoryReaction"("userId","createdAt");

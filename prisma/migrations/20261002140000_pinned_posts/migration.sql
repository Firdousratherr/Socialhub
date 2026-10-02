ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Post_authorId_isPinned_createdAt_idx"
  ON "Post"("authorId","isPinned","createdAt");

ALTER TABLE "Post"
  ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Post_authorId_isPinned_createdAt_idx"
  ON "Post"("authorId","isPinned","createdAt");

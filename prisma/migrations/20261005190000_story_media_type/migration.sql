-- Store whether a story payload is rendered as an image or video.
ALTER TABLE "Story"
  ADD COLUMN IF NOT EXISTS "mediaType" TEXT NOT NULL DEFAULT 'IMAGE';

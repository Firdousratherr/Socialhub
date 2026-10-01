CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
  ON "User" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_username_trgm_idx"
  ON "User" USING GIN ("username" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Post_content_trgm_idx"
  ON "Post" USING GIN ("content" gin_trgm_ops);

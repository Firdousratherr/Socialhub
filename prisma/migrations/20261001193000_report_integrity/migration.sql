-- Enforce one active report per reporter/target even under concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS "Report_active_reporter_post_key"
ON "Report" ("reporterId", "postId")
WHERE "postId" IS NOT NULL AND "status" IN ('PENDING', 'REVIEWED');

CREATE UNIQUE INDEX IF NOT EXISTS "Report_active_reporter_comment_key"
ON "Report" ("reporterId", "commentId")
WHERE "commentId" IS NOT NULL AND "status" IN ('PENDING', 'REVIEWED');

CREATE UNIQUE INDEX IF NOT EXISTS "Report_active_reporter_user_key"
ON "Report" ("reporterId", "reportedUserId")
WHERE "reportedUserId" IS NOT NULL AND "status" IN ('PENDING', 'REVIEWED');

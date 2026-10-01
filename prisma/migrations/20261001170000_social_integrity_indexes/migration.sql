-- Add a stable key for new direct conversations. Existing conversations remain NULL
-- and can be matched by the application fallback until migrated.
ALTER TABLE "Conversation" ADD COLUMN "directKey" TEXT;

CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");

CREATE INDEX "Post_createdAt_id_idx" ON "Post"("createdAt", "id");

CREATE INDEX "Message_conversationId_createdAt_id_idx"
  ON "Message"("conversationId", "createdAt", "id");

CREATE INDEX "FriendRequest_receiverId_updatedAt_idx"
  ON "FriendRequest"("receiverId", "updatedAt");

CREATE INDEX "Story_expiresAt_audience_idx"
  ON "Story"("expiresAt", "audience");

CREATE INDEX "Report_reporterId_createdAt_idx"
  ON "Report"("reporterId", "createdAt");

CREATE INDEX "Report_reportedUserId_createdAt_idx"
  ON "Report"("reportedUserId", "createdAt");

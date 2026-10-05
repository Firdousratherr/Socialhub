ALTER TYPE "AdminPermissionKey" ADD VALUE IF NOT EXISTS 'CASES_MANAGE';
ALTER TYPE "AdminPermissionKey" ADD VALUE IF NOT EXISTS 'ENFORCEMENT_MANAGE';
ALTER TYPE "AdminPermissionKey" ADD VALUE IF NOT EXISTS 'RISK_VIEW';
ALTER TYPE "AdminPermissionKey" ADD VALUE IF NOT EXISTS 'APPROVALS_MANAGE';
ALTER TYPE "AdminPermissionKey" ADD VALUE IF NOT EXISTS 'DATA_INTEGRITY';
ALTER TYPE "AdminPermissionKey" ADD VALUE IF NOT EXISTS 'RATE_LIMITS_VIEW';

-- Admin 4.0 operational controls and investigation history
ALTER TABLE "User"
  ADD COLUMN "postingRestrictedUntil" TIMESTAMP(3),
  ADD COLUMN "commentingRestrictedUntil" TIMESTAMP(3),
  ADD COLUMN "messagingRestrictedUntil" TIMESTAMP(3),
  ADD COLUMN "socialRestrictedUntil" TIMESTAMP(3);

CREATE INDEX "User_postingRestrictedUntil_idx" ON "User"("postingRestrictedUntil");
CREATE INDEX "User_commentingRestrictedUntil_idx" ON "User"("commentingRestrictedUntil");
CREATE INDEX "User_messagingRestrictedUntil_idx" ON "User"("messagingRestrictedUntil");
CREATE INDEX "User_socialRestrictedUntil_idx" ON "User"("socialRestrictedUntil");

CREATE TABLE "AdminCase" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "subjectUserId" TEXT,
  "postId" TEXT,
  "commentId" TEXT,
  "conversationId" TEXT,
  "assignedToId" TEXT,
  "createdById" TEXT NOT NULL,
  "reason" TEXT,
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "AdminCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminCase_status_priority_createdAt_idx" ON "AdminCase"("status","priority","createdAt");
CREATE INDEX "AdminCase_subjectUserId_createdAt_idx" ON "AdminCase"("subjectUserId","createdAt");
CREATE INDEX "AdminCase_assignedToId_status_priority_idx" ON "AdminCase"("assignedToId","status","priority");

CREATE TABLE "AdminCaseEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminCaseEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminCaseEvent_caseId_createdAt_idx" ON "AdminCaseEvent"("caseId","createdAt");
CREATE INDEX "AdminCaseEvent_actorId_createdAt_idx" ON "AdminCaseEvent"("actorId","createdAt");

CREATE TABLE "AdminEnforcementAction" (
  "id" TEXT NOT NULL,
  "subjectUserId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "caseId" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminEnforcementAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminEnforcementAction_subjectUserId_createdAt_idx" ON "AdminEnforcementAction"("subjectUserId","createdAt");
CREATE INDEX "AdminEnforcementAction_caseId_createdAt_idx" ON "AdminEnforcementAction"("caseId","createdAt");
CREATE INDEX "AdminEnforcementAction_action_createdAt_idx" ON "AdminEnforcementAction"("action","createdAt");

CREATE TABLE "AdminRiskSignal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "details" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "AdminRiskSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminRiskSignal_userId_detectedAt_idx" ON "AdminRiskSignal"("userId","detectedAt");
CREATE INDEX "AdminRiskSignal_score_detectedAt_idx" ON "AdminRiskSignal"("score","detectedAt");
CREATE INDEX "AdminRiskSignal_resolvedAt_detectedAt_idx" ON "AdminRiskSignal"("resolvedAt","detectedAt");

CREATE TABLE "AdminAppeal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "caseId" TEXT,
  "reason" TEXT NOT NULL,
  "evidence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "reviewerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "AdminAppeal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAppeal_status_createdAt_idx" ON "AdminAppeal"("status","createdAt");
CREATE INDEX "AdminAppeal_userId_createdAt_idx" ON "AdminAppeal"("userId","createdAt");
CREATE INDEX "AdminAppeal_caseId_createdAt_idx" ON "AdminAppeal"("caseId","createdAt");

CREATE TABLE "AdminApprovalRequest" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "approverId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "payload" TEXT,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  CONSTRAINT "AdminApprovalRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminApprovalRequest_status_createdAt_idx" ON "AdminApprovalRequest"("status","createdAt");
CREATE INDEX "AdminApprovalRequest_requesterId_createdAt_idx" ON "AdminApprovalRequest"("requesterId","createdAt");
CREATE INDEX "AdminApprovalRequest_targetType_targetId_idx" ON "AdminApprovalRequest"("targetType","targetId");

CREATE TABLE "AdminFlagChange" (
  "id" TEXT NOT NULL,
  "flagKey" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "before" BOOLEAN NOT NULL,
  "after" BOOLEAN NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminFlagChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminFlagChange_flagKey_createdAt_idx" ON "AdminFlagChange"("flagKey","createdAt");
CREATE INDEX "AdminFlagChange_actorId_createdAt_idx" ON "AdminFlagChange"("actorId","createdAt");

CREATE TABLE "AdminSettingChange" (
  "id" TEXT NOT NULL,
  "settingKey" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "before" TEXT,
  "after" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSettingChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminSettingChange_settingKey_createdAt_idx" ON "AdminSettingChange"("settingKey","createdAt");
CREATE INDEX "AdminSettingChange_actorId_createdAt_idx" ON "AdminSettingChange"("actorId","createdAt");

CREATE TABLE "AdminAuditEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "caseId" TEXT,
  "reason" TEXT,
  "permission" TEXT,
  "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  "before" TEXT,
  "after" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAuditEvent_actorId_createdAt_idx" ON "AdminAuditEvent"("actorId","createdAt");
CREATE INDEX "AdminAuditEvent_resource_resourceId_createdAt_idx" ON "AdminAuditEvent"("resource","resourceId","createdAt");
CREATE INDEX "AdminAuditEvent_caseId_createdAt_idx" ON "AdminAuditEvent"("caseId","createdAt");
CREATE INDEX "AdminAuditEvent_riskLevel_createdAt_idx" ON "AdminAuditEvent"("riskLevel","createdAt");
CREATE INDEX "AdminAuditEvent_outcome_createdAt_idx" ON "AdminAuditEvent"("outcome","createdAt");

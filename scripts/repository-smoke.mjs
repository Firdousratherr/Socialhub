import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "app/[...segments]/page.tsx",
  "app/api/admin/_auth.ts",
  "app/api/admin/reports/route.ts",
  "app/api/conversations/route.ts",
  "app/api/conversations/[conversationId]/messages/route.ts",
  "app/api/friend-requests/route.ts",
  "app/api/friends/[friendId]/route.ts",
  "app/api/notifications/route.ts",
  "app/api/realtime/route.ts",
  "app/api/push/register/route.ts",
  "app/api/presence/route.ts",
  "app/api/privacy-settings/route.ts",
  "app/api/profile/route.ts",
  "app/api/search/route.ts",
  "app/api/stories/route.ts",
  "app/api/stories/[storyId]/route.ts",
  "app/api/uploads/route.ts",
  "app/api/users/route.ts",
  "app/api/users/[username]/route.ts",
  "app/api/users/[username]/posts/route.ts",
  "app/api/users/[userId]/relationships/route.ts",
  "app/api/security/sessions/route.ts",
  "app/api/admin/permissions/route.ts",
  "app/api/admin/analytics/route.ts",
  "app/api/admin/storage/route.ts",
  "app/api/admin/comments/route.ts",
  "app/api/admin/stories/route.ts",
  "app/api/announcements/route.ts",
  "app/two-factor/page.tsx",
  "proxy.ts",
  "lib/auth.ts",
  "lib/post-access.ts",
  "lib/social-access.ts",
  "lib/realtime.ts",
  "prisma/schema.prisma",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing required Socialhub files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const requiredScripts = ["db:validate", "typecheck", "build:ci"];
const missingScripts = requiredScripts.filter((name) => typeof packageJson.scripts?.[name] !== "string");
if (missingScripts.length) {
  console.error("Missing required npm scripts:", missingScripts.join(", "));
  process.exit(1);
}

const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const requiredSchemaModels = [
  "model User",
  "model Post",
  "model FriendRequest",
  "model Conversation",
  "model Message",
  "model Notification",
  "model Story",
  "model Report",
  "model Block",
  "model VerificationRequest",
  "model UploadUsage",
  "model AdminPermission",
  "model SystemSetting",
  "model FeatureFlag",
  "model Announcement",
  "model ProfileView",
  "model RateLimitBucket",
  "model TwoFactor",
  "model Mute",
  "model PushDevice",
  "model Presence",
  "model RealtimeEvent",
];
const missingModels = requiredSchemaModels.filter((marker) => !schema.includes(marker));
if (missingModels.length) {
  console.error("Missing required Prisma schema models:");
  for (const marker of missingModels) console.error(`- ${marker}`);
  process.exit(1);
}

if (schema.includes("model AdminLoginAttempt") === false) {
  console.error("Missing distributed admin login-attempt model.");
  process.exit(1);
}

console.log(`Socialhub repository smoke test passed: ${requiredFiles.length} critical files, required npm scripts, and security/social schema markers verified.`);

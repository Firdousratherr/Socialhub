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
  "app/api/privacy-settings/route.ts",
  "app/api/profile/route.ts",
  "app/api/search/route.ts",
  "app/api/stories/route.ts",
  "app/api/stories/[storyId]/route.ts",
  "app/api/uploads/route.ts",
  "app/api/users/route.ts",
  "app/api/users/[username]/route.ts",
  "app/api/users/[userId]/relationships/route.ts",
  "app/api/security/sessions/route.ts",
  "lib/auth.ts",
  "lib/post-access.ts",
  "lib/social-access.ts",
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

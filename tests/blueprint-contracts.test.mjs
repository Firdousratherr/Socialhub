import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("conversation authorization centralizes block and privacy checks", () => {
  const helper = read("lib/conversation-access.ts");
  assert.match(helper, /isBlocked/);
  assert.match(helper, /allowMessagesEveryone/);
  assert.match(helper, /canCreateGroupWith/);
  assert.match(helper, /canSendMessageInConversation/);
});

test("password recovery does not disclose account existence", () => {
  const route = read("app/api/auth/request-password-reset/route.ts");
  assert.match(route, /return NextResponse.json\(\{ success: true \}\)/);
  assert.ok(!route.includes("No Socialhub account is registered with this email address."));
});

test("uploads enforce a daily quota and clean up tracking failures", () => {
  const route = read("app/api/uploads/route.ts");
  assert.match(route, /MAX_DAILY_UPLOAD_BYTES/);
  assert.match(route, /safeDeleteBlob\(blob.url\)/);
});

test("profile photo tab filters media posts before rendering", () => {
  const component = read("components/social-pages.tsx");
  assert.ok(component.includes("visibleProfilePosts"));
  assert.ok(component.includes('profileTab === "photos"'));
  assert.ok(component.includes("post.mediaUrl"));
});

test("deep-linked posts can be resolved from the post endpoint", () => {
  const feed = read("components/home-feed.tsx");
  const route = read("app/api/posts/[postId]/route.ts");
  assert.match(feed, /startsWith\("post-"\)/);
  assert.ok(feed.includes('fetch("/api/posts/'));
  assert.match(route, /export async function GET/);
});

test("group management endpoint exposes rename, membership and leave operations", () => {
  const route = read("app/api/conversations/[conversationId]/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function DELETE/);
});


test("paginated relationship lists still honor list-level privacy", () => {
  const route = read("app/api/users/[userId]/relationships/route.ts");
  assert.match(route, /showFollowersList/);
  assert.match(route, /showFollowingList/);
  assert.match(route, /listIsHidden/);
});

test("configured administrator is verified before Better Auth password sign-in", () => {
  const route = read("app/api/admin/login/route.ts");
  const verifiedIndex = route.indexOf("emailVerified: true");
  const signInIndex = route.indexOf("auth.api.signInEmail");
  assert.ok(verifiedIndex >= 0, "admin login must explicitly verify the configured admin account");
  assert.ok(signInIndex >= 0, "admin login must use Better Auth sign-in");
  assert.ok(verifiedIndex < signInIndex, "admin verification must happen before Better Auth enforces email verification");
});


test("admin profile metric controls validate, audit, and reset overrides", () => {
  const route = read("app/api/admin/users/[userId]/route.ts");
  assert.match(route, /metricSchema/);
  assert.match(route, /Only administrators can change profile metric overrides/);
  assert.match(route, /UPDATE_PROFILE_METRICS/);
  assert.match(route, /adminMetricOverride\.upsert/);
  assert.match(route, /adminMetricOverride\.deleteMany/);
  assert.match(route, /max\(1_000_000_000\)/);
});

test("public profiles resolve admin-controlled visible metrics without replacing real records", () => {
  const route = read("app/api/users/[username]/route.ts");
  assert.match(route, /visibleCounts/);
  assert.match(route, /override\?\.followers \?\? user\._count\.followers/);
  assert.match(route, /override\?\.likesReceived \?\? actualLikesReceived/);
  const ownProfile = read("app/api/profile/route.ts");
  assert.match(ownProfile, /adminMetricOverride/);
  assert.match(ownProfile, /visibleCounts/);
});

test("admin UI exposes profile metric and account control sections", () => {
  const panel = read("components/admin-panel.tsx");
  assert.match(panel, /Profile metrics control/);
  assert.match(panel, /Reset all to live/);
  assert.match(panel, /Account controls/);
});


test("admin root opens the current control center and keeps legacy tools reachable", () => {
  const panel = read("components/admin-panel.tsx");
  const route = read("app/[...segments]/page.tsx");
  assert.ok(panel.includes('[["control", "Control center", Gauge]'));
  assert.ok(panel.includes('active === "control" ? <AdminControlCenter/> : null'));
  assert.ok(panel.includes('[["overview", "Dashboard", BarChart3]'));
  assert.ok(panel.includes('[["moderation", "Moderation", Shield]'));
  assert.ok(route.includes('segments[1] ?? "control"'));
});


test("admin permissions have a centralized server authorization boundary", () => {
  const helper = read("lib/admin-permissions.ts");
  assert.match(helper, /ADMIN_PERMISSIONS/);
  assert.match(helper, /requireAdminPermission/);
  assert.match(helper, /adminId_permission/);
});

test("suspended or deleted users cannot create new Better Auth sessions", () => {
  const auth = read("lib/auth.ts");
  assert.match(auth, /suspendedUntil/);
  assert.match(auth, /deletedAt/);
  assert.match(auth, /session:/);
});

test("profile views are persisted and exposed as real metrics", () => {
  const profile = read("app/api/users/[username]/route.ts");
  const schema = read("prisma/schema.prisma");
  assert.match(profile, /profileView.create/);
  assert.match(profile, /actualProfileViews/);
  assert.match(schema, /model ProfileView/);
});

test("custom API mutations have same-origin protection", () => {
  const middleware = read("middleware.ts");
  assert.match(middleware, /Cross-origin state-changing requests are not allowed/);
  assert.match(middleware, /sec-fetch-site/);
});

test("high-cost social mutations use the shared rate limiter", () => {
  const route = read("app/api/posts/route.ts");
  assert.match(route, /consumeRateLimit/);
  assert.match(route, /rateLimitResponse/);
});
test("runtime registration setting is enforced server-side", () => {
  const auth = read("lib/auth.ts");
  assert.match(auth, /registration.enabled/);
  assert.match(auth, /Registration is currently disabled/);
});

test("two-factor authentication is wired through server, client and route", () => {
  const auth = read("lib/auth.ts");
  const client = read("lib/auth-client.ts");
  const page = read("app/two-factor/page.tsx");
  assert.match(auth, /twoFactor/);
  assert.match(client, /twoFactorClient/);
  assert.match(page, /verifyTotp/);
});


test("production hardening migrations tolerate already-present foreign keys", () => {
  const hardening = read("prisma/migrations/20261002170000_production_hardening/migration.sql");
  const twoFactor = read("prisma/migrations/20261002172000_two_factor/migration.sql");
  assert.match(hardening, /pg_constraint/);
  assert.match(hardening, /AdminMetricOverride_userId_fkey/);
  assert.match(hardening, /AdminAuditLog_adminId_fkey/);
  assert.match(hardening, /ProfileView_profileId_fkey/);
  assert.match(hardening, /ProfileView_viewerId_fkey/);
  assert.match(twoFactor, /pg_constraint/);
  assert.match(twoFactor, /TwoFactor_userId_fkey/);
});

test("production schema recovery synchronizes the committed schema before reconciling Prisma migration history", () => {
  const script = read("scripts/ensure-production-schema.mjs");
  const pinnedMigration = read("prisma/migrations/20261002140000_pinned_posts/migration.sql");
  assert.match(script, /const synchronizeProductionSchema/);
  assert.match(script, /run\(\["db", "push"\]\);/);
  assert.match(script, /markAllMigrationsApplied\(\);/);
  assert.doesNotMatch(script, /migrate", "deploy/);
  assert.doesNotMatch(script, /--skip-generate/);
  assert.match(pinnedMigration, /ADD COLUMN IF NOT EXISTS/);
  assert.match(pinnedMigration, /CREATE INDEX IF NOT EXISTS/);
});

test("mobile primary navigation exposes direct messages in the bottom bar", () => {
  const nav = read("components/bottom-nav.tsx");
  assert.match(nav, /href: "\/messages"/);
  assert.match(nav, /fixed inset-x-0 bottom-0/);
  assert.match(nav, /MessageCircle/);
});

test("messaging has live refresh, typing presence, and read receipts", () => {
  const component = read("components/social-pages.tsx");
  const typing = read("app/api/conversations/[conversationId]/typing/route.ts");
  assert.match(component, /setInterval\(\(\) => \{ void loadMessages\(\); \}, 2000\)/);
  assert.match(component, /setInterval\(\(\) => \{ void refreshTyping\(\); \}, 2000\)/);
  assert.match(component, /is typing/);
  assert.match(component, /Seen/);
  assert.match(typing, /export async function GET/);
  assert.match(typing, /export async function POST/);
  assert.match(typing, /export async function DELETE/);
  assert.match(typing, /typing:/);
});

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
  assert.ok(panel.includes('["control", "Control center", Gauge]'));
  assert.ok(panel.includes('active === "control" ? <AdminControlCenter/> : null'));
  assert.ok(panel.includes('["overview", "Dashboard", BarChart3]'));
  assert.ok(panel.includes('["moderation", "Moderation", Shield]'));
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
  assert.match(nav, /fixed inset-x-2 bottom-2/);
  assert.match(nav, /MessageCircle/);
});


test("feed mobile navigation uses messages instead of the legacy create-plus slot", () => {
  const nav = read("components/bottom-nav.tsx");
  const page = read("components/social-pages.tsx");
  assert.ok(nav.includes('{ href: "/messages", label: "Messages", Icon: MessageCircle }'));
  assert.ok(nav.includes('grid-cols-5'));
  assert.ok(page.includes('<BottomNav />'));
  assert.doesNotMatch(nav, /\bPlus\b/);
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


test("comment mutations expose authoritative counts and the client can recover from comment load errors", () => {
  const route = read("app/api/posts/[postId]/comments/route.ts");
  const feed = read("components/home-feed.tsx");
  assert.match(route, /commentCount/);
  assert.match(route, /adminPostMetricOverride/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function DELETE/);
  assert.match(feed, /typeof json\.commentCount === "number"/);
  assert.match(feed, />Retry<\/button>/);
  assert.ok(feed.includes('aria-controls={"comments-" + post.id}'));
});

test("post metric overrides have a dedicated model, migration and permission boundary", () => {
  const schema = read("prisma/schema.prisma");
  const permissions = read("lib/admin-permissions.ts");
  const migration = read("prisma/migrations/20261002190000_admin_post_metrics/migration.sql");
  const route = read("app/api/admin/posts/route.ts");
  assert.match(schema, /model AdminPostMetricOverride/);
  assert.match(schema, /postMetricOverride AdminPostMetricOverride/);
  assert.match(schema, /CONTENT_METRICS/);
  assert.match(permissions, /CONTENT_METRICS/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "AdminPostMetricOverride"/);
  assert.match(migration, /AdminPostMetricOverride_postId_fkey/);
  assert.match(route, /CONTENT_METRICS/);
  assert.match(route, /parsed\.data\.metrics !== undefined/);
  assert.match(route, /UPDATE_POST_METRICS/);
});

test("public post surfaces consume display metric overrides", () => {
  const feed = read("app/api/posts/route.ts");
  const detail = read("app/api/posts/[postId]/route.ts");
  const profilePosts = read("app/api/users/[username]/posts/route.ts");
  const home = read("components/home-feed.tsx");
  const pages = read("components/social-pages.tsx");
  assert.match(feed, /displayCounts/);
  assert.match(detail, /getPostDisplayCounts/);
  assert.match(profilePosts, /getPostDisplayCountsMap/);
  assert.match(home, /item\.displayCounts\?\.likes/);
  assert.match(pages, /post\.displayCounts\?\.likes/);
});

test("admin content UI exposes post-level display metric editing", () => {
  const panel = read("components/admin-panel.tsx");
  assert.match(panel, /Edit metrics/);
  assert.match(panel, /Post display metrics/);
  assert.match(panel, /Changes public counters only/);
  assert.match(panel, /Reset to live/);
});


test("admin global search does not expose messages without the dedicated permission", () => {
  const route = read("app/api/admin/search/route.ts");
  const permissions = read("lib/admin-permissions.ts");
  assert.match(route, /hasAdminPermission/);
  assert.match(route, /MESSAGES_VIEW/);
  assert.match(route, /messagesIncluded/);
  assert.match(permissions, /STORAGE_MANAGE/);
});

test("search and profile post pagination expose display post metrics", () => {
  const search = read("app/api/search/route.ts");
  const userPosts = read("app/api/users/[username]/posts/route.ts");
  const discover = read("components/social-pages.tsx");
  assert.match(search, /getPostDisplayCountsMap/);
  assert.match(userPosts, /getPostDisplayCountsMap/);
  assert.match(discover, /post\.displayCounts\?\.likes/);
});


test("post lifecycle changes synchronize feed and profile surfaces", () => {
  const sync = read("lib/post-sync.ts");
  const home = read("components/home-feed.tsx");
  const pages = read("components/social-pages.tsx");
  assert.match(sync, /BroadcastChannel/);
  assert.match(sync, /"created"/);
  assert.match(sync, /"updated"/);
  assert.match(sync, /"deleted"/);
  assert.match(home, /subscribePostSync/);
  assert.match(home, /document\.addEventListener\("visibilitychange"/);
  assert.match(home, /window\.addEventListener\("pageshow"/);
  assert.match(home, /event\.type === "deleted"/);
  assert.match(pages, /emitPostSyncEvent/);
  assert.match(pages, /type: "deleted", postId: post\.id/);
});

test("profile post pagination cursor preserves pinned ordering", () => {
  const route = read("app/api/users/[username]/posts/route.ts");
  assert.match(route, /isPinned\?: boolean/);
  assert.match(route, /isPinned: false/);
  assert.match(route, /isPinned: true/);
  assert.match(route, /encodeCursor\(isPinned: boolean/);
  assert.match(route, /encodeCursor\(posts\.at\(-1\)!\.isPinned/);
});

test("home feed uses one shared post mapper and one shared mobile navigation", () => {
  const home = read("components/home-feed.tsx");
  const nav = read("components/bottom-nav.tsx");
  assert.equal((home.match(/function mapApiPostToFeedPost\(/g) ?? []).length, 1);
  assert.equal((home.match(/\.map\(mapApiPostToFeedPost\)/g) ?? []).length, 2);
  assert.match(home, /<BottomNav \/>/);
  assert.doesNotMatch(home, /fixed inset-x-2 bottom-2/);
  assert.match(nav, /href: "\/messages"/);
});


test("admin post deletion cleans media and broadcasts feed invalidation", () => {
  const route = read("app/api/admin/posts/route.ts");
  const panel = read("components/admin-panel.tsx");
  assert.match(route, /safeDeleteBlob\(post\.mediaUrl\)/);
  assert.match(route, /mediaUrl: true/);
  assert.match(panel, /emitPostSyncEvent/);
  assert.match(panel, /type: "deleted", postId: id/);
});


test("profile metadata endpoints do not duplicate the dedicated post feed query", () => {
  const publicProfile = read("app/api/users/[username]/route.ts");
  const ownProfile = read("app/api/profile/route.ts");
  const page = read("components/social-pages.tsx");
  assert.doesNotMatch(publicProfile, /const posts = await prisma\.post\.findMany/);
  assert.doesNotMatch(ownProfile, /posts: \{/);
  assert.ok(page.includes('fetch("/api/users/" + encodeURIComponent(profile.username ?? username) + "/posts?take=20"'));
  assert.ok(page.includes('setProfile((current) => current ? { ...current, posts: json.posts ?? [] } : current)'));
});

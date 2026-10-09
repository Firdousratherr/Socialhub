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

test("custom API mutations have same-origin protection at the Next.js 16 proxy boundary", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /requireSameOrigin/);
  assert.match(proxy, /X-Request-ID/);
  assert.doesNotMatch(proxy, /export function middleware/);
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
  const shell = read("components/app-shell.tsx");
  assert.ok(shell.includes("<BottomNav />"));
  assert.doesNotMatch(nav, /\bPlus\b/);
});

test("messaging has live refresh, typing presence, and read receipts", () => {
  const component = read("components/social-pages.tsx");
  const typing = read("app/api/conversations/[conversationId]/typing/route.ts");
  assert.match(component, /window\.setInterval\(\(\) => \{[\s\S]*?loadMessages\(\);[\s\S]*?\}, 2000\)/);
  assert.match(component, /window\.setInterval\(\(\) => \{[\s\S]*?refreshTyping\(\);[\s\S]*?\}, 2000\)/);
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
  assert.ok(feed.includes('commentControlId={"comments-" + post.id}'));
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
  assert.equal((home.match(/\.map\(mapApiPostToFeedPost\)/g) ?? []).length, 3);
  const shell = read("components/app-shell.tsx");
  assert.match(shell, /<BottomNav \/>/);
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


test("unread summary powers shared navigation badges", () => {
  const route = read("app/api/unread-summary/route.ts");
  const hook = read("hooks/use-unread-summary.ts");
  const nav = read("components/bottom-nav.tsx");
  const home = read("components/home-feed.tsx");
  assert.match(route, /unreadCount/);
  assert.match(route, /friendRequestCount/);
  assert.match(hook, /\/api\/unread-summary/);
  assert.match(hook, /8000/);
  assert.match(nav, /summary\.messages/);
  assert.match(nav, /summary\.notifications/);
  assert.match(nav, /summary\.friendRequests/);
  const shell = read("components/app-shell.tsx");
  assert.doesNotMatch(home, /unreadSummary/);
  assert.match(shell, /summary\.notifications/);
});


test("live UI uses a shared visibility-aware sync layer", () => {
  const live = read("lib/live-sync.ts");
  const poll = read("hooks/use-live-poll.ts");
  assert.match(live, /BroadcastChannel/);
  assert.match(live, /CustomEvent/);
  assert.match(poll, /document\.visibilityState/);
  assert.match(poll, /navigator\.onLine/);
});

test("unread summary polling is shared instead of one interval per mounted badge", () => {
  const hook = read("hooks/use-unread-summary.ts");
  assert.match(hook, /listeners = new Set/);
  assert.match(hook, /8000/);
  assert.doesNotMatch(hook, /setInterval\(\(\) => void refresh\(\), 15000\)/);
});

test("notifications refresh live and preserve older pagination results", () => {
  const page = read("components/social-pages.tsx");
  assert.match(page, /useLivePoll\(refreshNotifications, 6500/);
  assert.match(page, /freshIds/);
  assert.match(page, /subscribeLiveSync/);
});

test("feed exposes a non-jumping new-post affordance and live comment refresh", () => {
  const feed = read("components/home-feed.tsx");
  assert.match(feed, /useLivePoll\(refreshLiveFeed, 7000/);
  assert.match(feed, /newActivityCount/);
  assert.match(feed, /Jump to latest|new posts.*Show|new post.*Show/);
  assert.match(feed, /loadComments\(undefined, true\)/);
  assert.match(feed, /comment-created/);
});

test("mobile messaging switches between inbox and active chat", () => {
  const page = read("components/social-pages.tsx");
  assert.match(page, /activeId \? "hidden lg:block/);
  assert.match(page, /Back to conversations/);
  assert.match(page, /newMessagesCount/);
  assert.match(page, /Jump to latest/);
});

test("live refresh preserves pagination after older feed or chat content has been loaded", () => {
  const feed = read("components/home-feed.tsx");
  const pages = read("components/social-pages.tsx");
  assert.match(feed, /current\.length <= latest\.length/);
  assert.match(pages, /olderAlreadyLoaded/);
  assert.match(pages, /mergedMessages/);
  assert.match(pages, /if \(!olderAlreadyLoaded\) \{\s*setNextMessagesCursor/);
});

test("friend and message read actions refresh global unread state immediately", () => {
  const pages = read("components/social-pages.tsx");
  assert.match(pages, /emitUnreadSummarySync\(\)/);
  assert.match(pages, /friend-request-changed/);
});


test("mobile message composer remains visible inside a bounded chat viewport", () => {
  const page = read("components/social-pages.tsx");
  assert.match(page, /messages-shell/);
  assert.match(page, /h-\[calc\(100dvh-var\(--header-h\)-var\(--page-pad\)\)\]/);
  assert.match(page, /message-composer/);
  assert.doesNotMatch(page, /min-h-\[calc\(100dvh-150px\)\]/);
});

test("message polling preserves unseen indicators and older pagination state", () => {
  const page = read("components/social-pages.tsx");
  assert.match(page, /incomingMessages/);
  assert.match(page, /setNewMessagesCount\(\(count\) => count \+ incomingMessages\.length\)/);
  assert.match(page, /setNextMessagesCursor\(null\)/);
  assert.match(page, /if \(!olderAlreadyLoaded\)/);
  assert.doesNotMatch(page, /async function loadMessages\(\) \{\s*setNewMessagesCount\(0\)/);
});

test("message attachments honor the multiple-file input", () => {
  const page = read("components/social-pages.tsx");
  assert.match(page, /async function uploadAttachments\(files: File\[\]\)/);
  assert.match(page, /Array\.from\(event\.currentTarget\.files/);
  assert.match(page, /slice\(0, available\)/);
});

test("friend suggestions exclude existing connections and pending requests", () => {
  const route = read("app/api/users/route.ts");
  const page = read("components/social-pages.tsx");
  assert.match(route, /suggestionsMode/);
  assert.match(route, /!user\.isFollowing/);
  assert.match(route, /!user\.isFriend/);
  assert.match(route, /friendRequestStatus === "NONE"/);
  assert.match(route, /blockedIds/);
  assert.match(page, /suggestions=true/);
  assert.match(page, /!user\.isFriend/);
  assert.match(page, /!user\.isFollowing/);
});

test("discover private friend requests update their state immediately", () => {
  const page = read("components/social-pages.tsx");
  assert.match(page, /friendRequestStatus: "OUTGOING_PENDING"/);
  assert.match(page, /canSendFriendRequest: false/);
});

test("home keeps messages in the primary bottom bar and removes the non-functional moment promo", () => {
  const home = read("components/home-feed.tsx");
  assert.doesNotMatch(home, /aria-label="Messages"/);
  assert.doesNotMatch(home, /Small updates become meaningful memories/);
  const nav = read("components/bottom-nav.tsx");
  assert.match(nav, /href: "\/messages"/);
});


test("message API includes profile imagery and account badges for chat participants", () => {
  const route = read("app/api/conversations/[conversationId]/messages/route.ts");
  assert.match(route, /sender: \{ select: \{ id: true, name: true, username: true, image: true, isVerified: true, isOwner: true \} \}/);
});

test("messages and relationship pages pass real profile images to avatars", () => {
  const page = read("components/social-pages.tsx");
  assert.match(page, /image=\{activeMember\?\.image\}/);
  assert.match(page, /image=\{message\.sender\.image\}/);
  assert.match(page, /image=\{person\.image\}/);
});


test("compact social counts have stable K/M/B thresholds and sane inputs", () => {
  const formatter = read("lib/compact-count.ts");
  assert.match(formatter, /count < 1_000/);
  assert.match(formatter, /count < 1_000_000/);
  assert.match(formatter, /count < 1_000_000_000/);
  assert.match(formatter, /"K"/);
  assert.match(formatter, /"M"/);
  assert.match(formatter, /"B"/);
});

test("public social counters use the shared compact formatter without losing exact values", () => {
  const home = read("components/home-feed.tsx");
  const pages = read("components/social-pages.tsx");
  assert.match(home, /compactCount\(likeCount\)/);
  assert.match(home, /fullCount\(likeCount\)/);
  assert.match(pages, /compactCount\(followerCount\)/);
  assert.match(pages, /compactCount\(followingCount\)/);
  assert.match(pages, /compactCount\(likesReceivedCount\)/);
  assert.match(pages, /fullCount\(followerCount\)/);
  assert.match(pages, /fullCount\(followingCount\)/);
  assert.match(pages, /fullCount\(likesReceivedCount\)/);
});

test("text-only feed posts render user content without the generic moment placeholder", () => {
  const home = read("components/home-feed.tsx");
  assert.doesNotMatch(home, /Socialhub moment/);
  assert.doesNotMatch(home, /Keep the small moments/);
  assert.match(home, /post\.mediaUrl \? \(/);
});


test("Discover user search uses authoritative public display follower counts", () => {
  const route = read("app/api/users/route.ts");
  const page = read("components/social-pages.tsx");
  assert.match(route, /adminMetricOverride.findMany/);
  assert.match(route, /displayCounts/);
  assert.ok(route.includes("followers: metricByUser.get(user.id)?.followers"));
  assert.ok(page.includes("user.displayCounts?.followers ?? user._count.followers"));
});

test("admin control center exposes supported quick runtime controls", () => {
  const panel = read("components/admin-control-center.tsx");
  assert.match(panel, /Quick controls/);
  assert.match(panel, /registration.enabled/);
  assert.match(panel, /Feature switches/);
  assert.ok(panel.includes('save("flag",{key:f.key,enabled:!Boolean(f.enabled)})'));
});

test("announcement lifecycle actions are wired to existing audited admin endpoints", () => {
  const panel = read("components/admin-control-center.tsx");
  const route = read("app/api/admin/control-center/route.ts");
  assert.match(panel, /announcement.update/);
  assert.match(panel, /deleteAnnouncement/);
  assert.ok(panel.includes('status:a.status==="PUBLISHED"?"ARCHIVED":"PUBLISHED"'));
  assert.match(route, /kind === "announcement.update"/);
  assert.match(route, /DELETE_ANNOUNCEMENT/);
});

test("moderator permissions provide named presets without bypassing the permission matrix", () => {
  const presets = read("lib/admin-permission-presets.ts");
  const panel = read("components/admin-control-center.tsx");
  assert.match(presets, /Content moderator/);
  assert.match(presets, /Safety & reports/);
  assert.match(presets, /Community moderator/);
  assert.match(presets, /Full operations moderator/);
  assert.match(panel, /MODERATOR_PERMISSION_PRESETS/);
  assert.match(panel, /Save moderator permissions/);
});


test("Discover separates search from relationship-aware suggestions and uses public counts", () => {
  const search = read("app/api/search/route.ts");
  const pages = read("components/social-pages.tsx");
  assert.match(search, /adminMetricOverride\.findMany/);
  assert.ok(search.includes("followers: userMetricById.get(user.id)?.followers"));
  assert.ok(pages.includes("/api/users?suggestions=true&take=20"));
  assert.ok(pages.includes("user.displayCounts?.followers ?? user._count.followers"));
});

test("saved posts have a private collection endpoint and dedicated UI route", () => {
  const route = read("app/api/saved/route.ts");
  const page = read("app/saved/page.tsx");
  const ui = read("components/saved-posts.tsx");
  assert.match(route, /prisma\.savedPost\.findMany/);
  assert.match(route, /savedAt/);
  assert.match(page, /SavedPosts/);
  assert.match(ui, /Nothing saved yet/);
  assert.match(ui, /Load more/);
});

test("mobile navigation exposes saved posts", () => {
  const nav = read("components/mobile-menu.tsx");
  assert.match(nav, /href: "\/saved"/);
  assert.match(nav, /Saved posts/);
});

test("notification inbox has actionable filters", () => {
  const pages = read("components/social-pages.tsx");
  assert.match(pages, /NotificationFilter/);
  assert.match(pages, /Unread/);
  assert.match(pages, /Messages/);
  assert.match(pages, /Requests/);
});

test("message drafts persist per conversation and clear after send", () => {
  const pages = read("components/social-pages.tsx");
  assert.match(pages, /socialhub:draft:/);
  assert.match(pages, /localStorage\.setItem/);
  assert.match(pages, /localStorage\.removeItem/);
});

test("story viewer exposes grouped position and progress", () => {
  const story = read("components/story-center.tsx");
  assert.match(story, /viewer/);
  assert.match(story, /activeGroup/);
  assert.match(story, /progress|w-1\/3/);
  assert.match(story, /aria-label=\{"Story from /);
});

test("profile actions escape the clipped profile card and remain accessible on mobile", () => {
  const page = read("components/social-pages.tsx");
  assert.match(page, /createPortal/);
  assert.match(page, /document\.body/);
  assert.match(page, /profileMenuButtonRef/);
  assert.match(page, /profileMenuRef/);
});

test("stories expose authoritative views, reactions, replies, and owner viewers", () => {
  const feed = read("app/api/stories/route.ts");
  const detail = read("app/api/stories/[storyId]/route.ts");
  const storyUi = read("components/story-center.tsx");
  const schema = read("prisma/schema.prisma");
  assert.match(feed, /viewCount/);
  assert.match(feed, /reactionCount/);
  assert.match(feed, /replyCount/);
  assert.match(detail, /storyView\.findMany/);
  assert.match(detail, /reactionCounts/);
  assert.match(detail, /viewers/);
  assert.match(detail, /authorId: session\.user\.id/);
  assert.match(storyUi, /Story activity/);
  assert.match(storyUi, /Viewers/);
  assert.match(storyUi, /views/);
  assert.match(storyUi, /likes/);
  assert.match(storyUi, /replies/);
  assert.match(schema, /model StoryView/);
  assert.match(schema, /model StoryReply/);
  assert.match(schema, /model StoryReaction/);
});

test("story viewer keeps multi-story icons clean and media compact", () => {
  const storyUi = read("components/story-center.tsx");
  assert.doesNotMatch(storyUi, /bg-gray-950 px-1\.5 py-0\.5 text-\[9px\] font-black text-white.*\{total\}/);
  assert.doesNotMatch(storyUi, /total > 1 \? total \+ " stories/);
  assert.match(storyUi, /story-rail/);
  assert.match(storyUi, /story-avatar-ring/);
  assert.match(storyUi, /STORY_IMAGE_DURATION_MS/);
  assert.match(storyUi, /story-progress-fill/);
  assert.match(storyUi, /ArrowLeft/);
  assert.match(storyUi, /ArrowRight/);
  assert.match(storyUi, /h-\[48vh\].*max-h-\[56vh\]/);
  assert.match(storyUi, /mediaType === "VIDEO"/);
  assert.match(storyUi, /cursor-w-resize/);
  assert.match(storyUi, /cursor-e-resize/);
});

test("story activity can expand with swipe gestures and exposes analysis", () => {
  const storyUi = read("components/story-center.tsx");
  assert.match(storyUi, /activityTouchStartY/);
  assert.match(storyUi, /delta < -36/);
  assert.match(storyUi, /Pull up for analysis & views/);
  assert.match(storyUi, /Reaction breakdown/);
  assert.match(storyUi, /Swipe up to see viewers & analysis/);
});

test("stories accept validated image and video media", () => {
  const validation = read("lib/validation.ts");
  const uploads = read("app/api/uploads/route.ts");
  const stories = read("app/api/stories/route.ts");
  const detail = read("app/api/stories/[storyId]/route.ts");
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261005190000_story_media_type/migration.sql");
  assert.match(validation, /mediaType: z\.enum\(\["IMAGE", "VIDEO"\]\)/);
  assert.match(uploads, /video\/mp4/);
  assert.match(uploads, /video\/webm/);
  assert.match(uploads, /detectVideoType/);
  assert.match(stories, /mediaType: parsed\.data\.mediaType/);
  assert.match(detail, /mediaType: access\.story\.mediaType/);
  assert.match(schema, /mediaType\s+String\s+@default\("IMAGE"\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "mediaType"/);
});

test("story replies and reactions have dedicated preference-aware notifications", () => {
  const route = read("app/api/stories/[storyId]/route.ts");
  const notifications = read("app/api/notifications/route.ts");
  const prefs = read("app/api/notification-preferences/route.ts");
  const pages = read("components/social-pages.tsx");
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261005180000_story_activity_notifications/migration.sql");
  assert.match(route, /type: "STORY_REPLY"/);
  assert.match(route, /type: "STORY_REACTION"/);
  assert.match(notifications, /STORY_REPLY/);
  assert.match(notifications, /STORY_REACTION/);
  assert.match(prefs, /storyReplies/);
  assert.match(prefs, /storyReactions/);
  assert.match(pages, /Story replies/);
  assert.match(pages, /Story reactions/);
  assert.match(schema, /STORY_REPLY/);
  assert.match(schema, /STORY_REACTION/);
  assert.match(schema, /storyId/);
  assert.match(migration, /STORY_REPLY/);
  assert.match(migration, /STORY_REACTION/);
});


test("mobile navigation has keyboard focus containment", () => {
  const menu = read("components/mobile-menu.tsx");
  assert.match(menu, /closeButtonRef/);
  assert.match(menu, /event\.key !== "Tab"/);
  assert.match(menu, /focusable/);
});

test("home composer preserves unfinished post drafts", () => {
  const home = read("components/home-feed.tsx");
  assert.match(home, /socialhub:post-draft:/);
  assert.match(home, /localStorage\.setItem/);
  assert.match(home, /localStorage\.removeItem/);
});

test("Discover cancels stale search requests", () => {
  const pages = read("components/social-pages.tsx");
  assert.match(pages, /new AbortController\(\)/);
  assert.match(pages, /controller\.abort\(\)/);
});


test("mentions create preference-aware notifications for posts and comments", () => {
  const helper = read("lib/mentions.ts");
  const posts = read("app/api/posts/route.ts");
  const comments = read("app/api/posts/[postId]/comments/route.ts");
  assert.match(helper, /extractMentionUsernames/);
  assert.match(helper, /mentions/);
  assert.match(helper, /type: "MENTION"/);
  assert.match(posts, /createMentionNotifications/);
  assert.match(comments, /createMentionNotifications/);
});

test("mobile navigation drawer is viewport-anchored and rendered outside the filtered sticky header", () => {
  const menu = read("components/mobile-menu.tsx");
  const css = read("app/globals.css");
  assert.match(menu, /createPortal/);
  assert.match(menu, /document\.body/);
  assert.match(menu, /mobile-menu-layer/);
  assert.match(menu, /aria-modal="true"/);
  assert.match(css, /\.mobile-menu-panel/);
  assert.match(css, /inset-block: 0/);
  assert.match(css, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
});

test("mobile content reserves space for the persistent bottom navigation", () => {
  const shell = read("components/app-shell.tsx");
  const css = read("app/globals.css");
  assert.match(shell, /mobile-safe-bottom/);
  assert.match(css, /--mobile-nav-h/);
  assert.match(css, /padding-bottom: calc\(var\(--mobile-nav-h\)/);
});



test("Admin 4.0 operational APIs exist with explicit control boundaries", () => {
  assert.ok(read("app/api/admin/command-center/route.ts").includes('requireAdminPermission("ANALYTICS_VIEW")'));
  assert.ok(read("app/api/admin/cases/route.ts").includes('requireAdminPermission("CASES_MANAGE")'));
  assert.ok(read("app/api/admin/enforcement/route.ts").includes('requireAdminPermission("ENFORCEMENT_MANAGE")'));
  assert.ok(read("app/api/admin/risk/route.ts").includes('requireAdminPermission("RISK_VIEW")'));
  assert.ok(read("app/api/admin/social-graph/route.ts").includes("REMOVE_FOLLOWER"));
  assert.ok(read("app/api/admin/rate-limits/route.ts").includes('requireAdminPermission("RATE_LIMITS_VIEW")'));
  assert.ok(read("app/api/admin/integrity/route.ts").includes('requireAdminPermission("DATA_INTEGRITY")'));
  assert.ok(read("app/api/admin/approvals/route.ts").includes('requesterId: access.user.id'));
});

test("Admin enforcement actions are actually enforced by user-facing APIs", () => {
  assert.match(read("app/api/posts/route.ts"), /postingRestrictedUntil/);
  assert.match(read("app/api/posts/[postId]/comments/route.ts"), /commentingRestrictedUntil/);
  assert.match(read("app/api/conversations/[conversationId]/messages/route.ts"), /messagingRestrictedUntil/);
  assert.match(read("app/api/users/[userId]/follow/route.ts"), /socialRestrictedUntil/);
  assert.match(read("app/api/friend-requests/route.ts"), /socialRestrictedUntil/);
  assert.match(read("app/api/stories/route.ts"), /postingRestrictedUntil/);
});

test("Emergency platform controls are enforced at runtime", () => {
  assert.match(read("app/api/posts/route.ts"), /platformEnabled\("posts", true\)/);
  assert.match(read("app/api/posts/[postId]/comments/route.ts"), /platformEnabled\("comments", true\)/);
  assert.match(read("app/api/conversations/[conversationId]/messages/route.ts"), /platformEnabled\("messaging", true\)/);
  assert.match(read("app/api/uploads/route.ts"), /platformEnabled\("uploads", true\)/);
  assert.match(read("app/api/stories/route.ts"), /platformEnabled\("stories", true\)/);
  assert.match(read("app/api/users/[userId]/follow/route.ts"), /platformEnabled\("social",?\s*true\)/);
  assert.match(read("app/api/friend-requests/route.ts"), /platformEnabled\("social",?\s*true\)/);
});

test("platform announcements are wired into the signed-in shell", () => {
  assert.equal(read("components/app-shell.tsx").includes("PlatformAnnouncements"), true);
  assert.equal(read("components/platform-announcements.tsx").includes("/api/announcements"), true);
});
test("home feed uses live trend data instead of hard-coded trend counters", () => {
  const source = read("components/home-feed.tsx");
  assert.equal(source.includes('/api/discover/trends'), true);
  assert.equal(source.includes('"#Socialhub", "1.2k posts"'), false);
});
test("same-tab sync events carry a browser source id", () => {
  assert.equal(read("lib/live-sync.ts").includes("sourceId"), true);
  assert.equal(read("lib/post-sync.ts").includes("sourceId"), true);
});
test("blocked-account management and account export endpoints are present", () => {
  assert.equal(read("app/api/blocks/route.ts").includes("export async function GET"), true);
  assert.equal(read("app/api/privacy/export/route.ts").includes("account-export"), true);
});
test("root recovery boundaries are present", () => {
  assert.equal(read("app/error.tsx").includes("reset"), true);
  assert.equal(read("app/loading.tsx").includes("Loading Socialhub"), true);
});


test("unread notification badges honor muted actors", () => {
  const summary = read("app/api/unread-summary/route.ts");
  assert.match(summary, /getMutedUserIds/);
  assert.match(summary, /actorId: \{ notIn: mutedIds \}/);
});

test("account mutes have durable schema, management APIs, and feed/notification enforcement", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261005200000_account_mutes/migration.sql");
  const profile = read("app/api/users/[username]/route.ts");
  const feed = read("app/api/posts/route.ts");
  const notifications = read("app/api/notifications/route.ts");
  const muteRoute = read("app/api/users/[userId]/mute/route.ts");
  const mutes = read("app/api/mutes/route.ts");
  assert.match(schema, /model Mute/);
  assert.match(schema, /mutesGiven/);
  assert.match(migration, /CREATE TABLE "Mute"/);
  assert.match(profile, /isMuted/);
  assert.match(feed, /getMutedUserIds/);
  assert.match(notifications, /getMutedUserIds/);
  assert.match(muteRoute, /export async function POST/);
  assert.match(muteRoute, /export async function DELETE/);
  assert.match(mutes, /export async function GET/);
});

test("high-volume social mutations use targeted rate-limit buckets", () => {
  for (const path of [
    "app/api/posts/[postId]/like/route.ts",
    "app/api/posts/[postId]/reaction/route.ts",
    "app/api/posts/[postId]/save/route.ts",
    "app/api/posts/[postId]/share/route.ts",
    "app/api/posts/[postId]/report/route.ts",
  ]) {
    assert.match(read(path), /consumeMutationRateLimit/);
    assert.match(read(path), /rateLimitResponse/);
  }
});

test("rate limiting increments buckets atomically", () => {
  const limiter = read("lib/rate-limit.ts");
  assert.match(limiter, /ON CONFLICT \("key"\) DO UPDATE/);
  assert.match(limiter, /"count" \+ 1/);
  assert.match(limiter, /RETURNING "count", "resetAt"/);
  assert.doesNotMatch(limiter, /findUnique\(\{ where: \{ key \}\}\)/);
});

test("admin risk reads do not create duplicate dynamic signals", () => {
  const route = read("app/api/admin/risk/route.ts");
  assert.match(route, /findFirst\(\{[\s\S]*kind: "DYNAMIC_ACTIVITY"/);
  assert.doesNotMatch(route, /adminRiskSignal\.create/);
});

test("admin case ordering treats priority as severity, not alphabetic text", () => {
  const route = read("app/api/admin/cases/route.ts");
  assert.match(route, /priorityRank/);
  assert.match(route, /CRITICAL: 4/);
  assert.match(route, /HIGH: 3/);
});

test("admin bulk operations provide a dry-run safety preview", () => {
  const route = read("app/api/admin/bulk/route.ts");
  const ui = read("components/admin-workspace.tsx");
  assert.match(route, /dryRun: z.boolean/);
  assert.match(route, /skippedOwnerCount/);
  assert.match(ui, /previewBulk/);
  assert.match(ui, /No data was changed|no changes made/);
});


test("private page routing has a centralized authentication policy and login return path", () => {
  const access = read("lib/route-access.ts");
  const policy = read("lib/route-policy.ts");
  const proxy = read("proxy.ts");
  const route = read("app/[...segments]/page.tsx");
  assert.match(policy, /PUBLIC_PAGE_PATHS/);
  assert.match(policy, /sanitizeNextPath/);
  assert.match(policy, /loginRedirectPath/);
  assert.match(access, /requireUser/);
  assert.match(proxy, /auth\.api\.getSession/);
  assert.match(proxy, /NextResponse\.redirect/);
  assert.match(proxy, /next.*pathname/);
  assert.match(route, /requireUser/);
  assert.match(route, /nextParam/);
});

test("direct private pages enforce server-side authentication", () => {
  const home = read("app/home/page.tsx");
  const saved = read("app/saved/page.tsx");
  const profile = read("app/profile/[username]/page.tsx");
  assert.match(home, /requireUser\("\/home"\)/);
  assert.match(saved, /requireUser\("\/saved"\)/);
  assert.match(profile, /await requireUser\("\/profile\//);
});

test("authentication forms preserve the originally requested internal route", () => {
  const page = read("components/social-pages.tsx");
  const route = read("app/[...segments]/page.tsx");
  assert.match(page, /nextPath = "\/home"/);
  assert.match(page, /callbackURL: nextPath/);
  assert.match(page, /router\.replace\(nextPath\)/);
  assert.match(route, /sanitizeNextPath\(nextParam/);
});

test("public and private page policy distinguishes auth entry points from social routes", () => {
  const policy = read("lib/route-policy.ts");
  const proxy = read("proxy.ts");
  for (const path of ["/", "/login", "/signup", "/admin/login", "/two-factor"]) {
    assert.match(policy, new RegExp(JSON.stringify(path).slice(1, -1).replace(/[.*+?^$()|[\]\\]/g, "\\$&")));
  }
  assert.match(proxy, /isPublicPagePath/);
  assert.match(proxy, /matcher:\s*\[/);
  assert.match(proxy, /_next/);
});


test("realtime push foundation has recipient-scoped events, presence privacy, and Android registration", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261007153000_realtime_push_foundation/migration.sql");
  const realtime = read("lib/realtime.ts");
  const realtimeRoute = read("app/api/realtime/route.ts");
  const pushRoute = read("app/api/push/register/route.ts");
  const presenceRoute = read("app/api/presence/route.ts");
  const privacyRoute = read("app/api/privacy-settings/route.ts");
  const messageRoute = read("app/api/conversations/[conversationId]/messages/route.ts");
  const mobilePush = read("mobile/lib/push.ts");
  const mobileRealtime = read("mobile/lib/realtime.ts");
  const mobileApp = read("mobile/App.tsx");
  const mobileSettings = read("mobile/screens/SettingsScreen.tsx");

  assert.match(schema, /model PushDevice/);
  assert.match(schema, /model Presence/);
  assert.match(schema, /model RealtimeEvent/);
  assert.match(schema, /showActiveStatus\s+Boolean\s+@default\(true\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "PushDevice"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "Presence"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "RealtimeEvent"/);

  assert.match(realtime, /publishConversationEvent/);
  assert.match(realtime, /recipientId/);
  assert.match(realtimeRoute, /readRealtimeEvents/);
  assert.match(pushRoute, /pushDeviceInputSchema/);
  assert.match(presenceRoute, /showActiveStatus/);
  assert.match(privacyRoute, /showActiveStatus/);
  assert.match(messageRoute, /publishConversationEvent/);

  assert.match(mobilePush, /requestPermissionsAsync/);
  assert.match(mobilePush, /getDevicePushTokenAsync/);
  assert.match(mobilePush, /addNotificationResponseReceivedListener/);
  assert.match(mobileRealtime, /\/api\/realtime/);
  assert.match(mobileRealtime, /subscribeRealtime/);
  assert.match(mobileApp, /startRealtime/);
  assert.match(mobileApp, /startPresenceHeartbeat/);
  assert.match(mobileSettings, /Push notifications on this device/);
  assert.match(mobileSettings, /Show active status/);
});

test("native push consent is not requested automatically at app boot", () => {
  const app = read("mobile/App.tsx");
  const settings = read("mobile/screens/SettingsScreen.tsx");
  assert.doesNotMatch(app, /requestPermissionsAsync/);
  assert.match(settings, /registerPushDevice/);
});


test("active-status privacy is exposed consistently on web and Android", () => {
  const web = read("components/social-pages.tsx");
  const api = read("app/api/privacy-settings/route.ts");
  const android = read("mobile/screens/SettingsScreen.tsx");
  const presence = read("app/api/presence/route.ts");
  assert.match(web, /showActiveStatus/);
  assert.match(web, /Show active status/);
  assert.match(api, /showActiveStatus/);
  assert.match(android, /Show active status/);
  assert.match(presence, /showActiveStatus/);
});

test("web application control exposes only server-enforced platform switches and validates APK URLs", () => {
  const route = read("app/api/admin/application-control/route.ts");
  const component = read("components/admin-application-control.tsx");
  const workspace = read("components/admin-workspace.tsx");
  const messagingRoute = read("app/api/conversations/[conversationId]/messages/route.ts");
  const messagePost = messagingRoute.slice(messagingRoute.indexOf("export async function POST"));
  const friendRequestRoute = read("app/api/friend-requests/[requestId]/route.ts");
  const registrationRoute = read("lib/auth.ts");
  const postsRoute = read("app/api/posts/route.ts");
  const commentsRoute = read("app/api/posts/[postId]/comments/route.ts");
  const storiesRoute = read("app/api/stories/route.ts");
  const uploadsRoute = read("app/api/uploads/route.ts");
  const followRoute = read("app/api/users/[userId]/follow/route.ts");
  const friendRequestCreateRoute = read("app/api/friend-requests/route.ts");
  const conversationsRoute = read("app/api/conversations/route.ts");
  const conversationGet = conversationsRoute.slice(conversationsRoute.indexOf("export async function GET"));
  const conversationPost = conversationsRoute.slice(conversationsRoute.indexOf("export async function POST"));
  const typingRoute = read("app/api/conversations/[conversationId]/typing/route.ts");
  const typingGet = typingRoute.slice(typingRoute.indexOf("export async function GET"));
  const typingPost = typingRoute.slice(typingRoute.indexOf("export async function POST"));
  const callsRoute = read("app/api/conversations/[id]/calls/route.ts");
  const callActionRoute = read("app/api/calls/[id]/route.ts");
  const callSignalsRoute = read("app/api/calls/[id]/signals/route.ts");
  const callSignalsGet = callSignalsRoute.slice(callSignalsRoute.indexOf("export async function GET"));
  const callSignalsPost = callSignalsRoute.slice(callSignalsRoute.indexOf("export async function POST"));
  assert.match(route, /requireAdminPermission\("PLATFORM_SETTINGS"\)/);
  assert.match(messagePost, /platformEnabled\("messaging", true\)/, "messaging control must be enforced on message creation, not only reads");
  assert.match(friendRequestRoute, /parsed\.data\.status === "ACCEPTED"[\s\S]*platformEnabled\("social", true\)/, "social control must block accepting new friend connections");
  assert.match(registrationRoute, /getBooleanSetting\("registration\.enabled", true\)/, "registration control must be enforced by the auth user-create hook");
  assert.match(postsRoute.slice(postsRoute.indexOf("export async function POST")), /platformEnabled\("posts", true\)/);
  assert.match(commentsRoute.slice(commentsRoute.indexOf("export async function POST")), /platformEnabled\("comments", true\)/);
  assert.match(storiesRoute.slice(storiesRoute.indexOf("export async function POST")), /platformEnabled\("stories", true\)/);
  assert.match(uploadsRoute.slice(uploadsRoute.indexOf("export async function POST")), /platformEnabled\("uploads", true\)/);
  assert.match(followRoute.slice(followRoute.indexOf("export async function POST")), /platformEnabled\("social",\s*true\)/);
  assert.match(friendRequestCreateRoute.slice(friendRequestCreateRoute.indexOf("export async function POST")), /platformEnabled\("social",\s*true\)/);
  assert.match(conversationGet, /platformEnabled\("messaging", true\)/, "disabled messaging must not reveal conversation previews");
  assert.match(conversationPost, /platformEnabled\("messaging", true\)/, "disabled messaging must prevent new conversations");
  assert.match(typingGet, /platformEnabled\("messaging", true\)/, "typing data must stop when messaging is disabled");
  assert.match(typingPost, /platformEnabled\("messaging", true\)/, "typing indicators must not be created while messaging is disabled");
  assert.match(callsRoute.slice(callsRoute.indexOf("export async function POST")), /platformEnabled\("messaging", true\)/, "audio/video calls must follow the messaging control");
  assert.match(callActionRoute, /if \(action === "accept"\)[\s\S]*platformEnabled\("messaging", true\)/, "calls must not be accepted after messaging is disabled");
  assert.match(callSignalsGet, /platformEnabled\("messaging", true\)/, "WebRTC signals must not be read while calls are disabled");
  assert.match(callSignalsPost, /platformEnabled\("messaging", true\)/, "WebRTC signals must not be created while calls are disabled");
  for (const key of [
    "registration.enabled",
    "platform.posts.enabled",
    "platform.comments.enabled",
    "platform.messaging.enabled",
    "platform.uploads.enabled",
    "platform.stories.enabled",
    "platform.social.enabled",
  ]) {
    assert.ok(route.includes('key: "' + key + '"') || route.includes('"' + key + '"'));
  }
  assert.match(route, /isDirectApkUrl\(data\.value\)/);
  assert.match(route, /recordAdminEvent/);
  assert.match(component, /role="switch"/);
  assert.match(component, /aria-checked=\{feature\.enabled\}/);
  assert.match(workspace, /label: "App control"/);
});

test("mobile admin navigation reaches every workspace section through a More menu", () => {
  const workspace = read("components/admin-workspace.tsx");
  assert.match(workspace, /aria-label="Admin navigation"/);
  assert.match(workspace, /aria-label="More admin sections"/);
  assert.match(workspace, /NAV\.filter\(\(item\) => !item\.mobile\)/);
  assert.match(workspace, /setMobileMoreOpen/);
  assert.ok(workspace.includes("bottom-[calc(5.75rem_+_env(safe-area-inset-bottom))]"));
});

test("storage cleanup protects URLs referenced by media-asset records", () => {
  const route = read("app/api/admin/storage/route.ts");
  const deletion = route.slice(route.indexOf("export async function DELETE"));
  assert.match(deletion, /prisma\.mediaAsset\.findMany/);
  assert.match(deletion, /for \(const row of mediaAssets\) referenced\.add\(row\.url\);/);
  const get = route.slice(0, route.indexOf("export async function DELETE"));
  assert.equal((get.match(/for \(const row of mediaAssets\) referenced\.add\(row\.url\);/g) ?? []).length, 1);
});

test("admin audit CSV exports use real line separators", () => {
  const route = read("app/api/admin/audit/route.ts");
  assert.ok(route.includes('.join("\\r\\n")'), "CSV rows should be separated by CRLF, not literal backslash characters");
});

test("operations center reads are filtered by the viewer's individual permissions", () => {
  const route = read("app/api/admin/control-center/route.ts");
  assert.match(route, /const access = await requireAdmin\(\)/);
  assert.match(route, /hasAdminPermission\(access\.user\.id, access\.user\.role, "PLATFORM_SETTINGS"\)/);
  assert.match(route, /hasAdminPermission\(access\.user\.id, access\.user\.role, "FEATURE_FLAGS"\)/);
  assert.match(route, /hasAdminPermission\(access\.user\.id, access\.user\.role, "SECURITY_MANAGE"\)/);
  assert.match(route, /capabilities:/);
});

test("moderator permission replacement and its audit record are atomic", () => {
  const route = read("app/api/admin/permissions/route.ts");
  assert.match(route, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(route, /tx\.adminPermission\.deleteMany/);
  assert.match(route, /tx\.adminPermission\.createMany/);
  assert.match(route, /tx\.adminAuditLog\.create/);
});

test("APK settings validate a direct asset URL in both new and legacy admin surfaces", () => {
  const route = read("app/api/admin/control-center/route.ts");
  const component = read("components/admin-app-download-settings.tsx");
  assert.match(route, /parsed\.data\.key === APP_DOWNLOAD_SETTING_KEY && !isDirectApkUrl\(parsed\.data\.value\)/);
  assert.match(component, /isDirectApkUrl\(next\)/);
});

test("APK fallback points to the latest published release and mobile package version matches the manifest", () => {
  const download = read("lib/app-download.ts");
  const app = JSON.parse(read("mobile/app.json"));
  const pkg = JSON.parse(read("mobile/package.json"));
  assert.match(download, /releases\/download\/v1\.0\.8\/app-release\.apk/);
  assert.equal(pkg.version, app.expo.version);
});


test("mobile API requests and media uploads use bounded timeouts and release loading states on stalled requests", () => {
  const api = read("mobile/lib/api.ts");
  assert.match(api, /API_REQUEST_TIMEOUT_MS\s*=\s*30_000/);
  assert.match(api, /UPLOAD_REQUEST_TIMEOUT_MS\s*=\s*60_000/);
  assert.match(api, /fetchJsonWithTimeout/);
  assert.match(api, /new AbortController\(\)/);
  assert.match(api, /The request timed out/);
});

test("admin control-center requests surface network errors and timeouts to the UI", () => {
  const panel = read("components/admin-control-center.tsx");
  assert.match(panel, /async function adminFetch/);
  assert.match(panel, /The admin request timed out/);
  assert.match(panel, /Could not reach the admin service/);
  assert.equal((panel.match(/\bfetch\(/g) ?? []).length, 1, "admin operations should route through the guarded request helper");
});

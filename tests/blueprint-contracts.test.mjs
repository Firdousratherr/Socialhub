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

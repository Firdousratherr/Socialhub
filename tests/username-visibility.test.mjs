import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("username generation strips plus-addressing and stays within the validator limit", () => {
  const auth = read("lib/auth.ts");
  const validation = read("lib/validation.ts");
  assert.match(auth, /localPart\.split\("\+"\)\[0\]/);
  assert.match(auth, /\.slice\(0, 30\)/);
  assert.match(validation, /username:.*\{3,30\}/);
  const home = read("components/home-feed.tsx");
  assert.doesNotMatch(home, /email\?\.split\(["']@["']\)/);
  assert.match(home, /user\.username/);
});

test("public user queries require verified, active, non-deleted accounts", () => {
  const helper = read("lib/user-visibility.ts");
  const users = read("app/api/users/route.ts");
  const search = read("app/api/search/route.ts");
  const profile = read("app/api/users/[username]/route.ts");
  assert.match(helper, /emailVerified: true/);
  assert.match(helper, /isActive: true/);
  assert.match(helper, /deletedAt: null/);
  assert.match(users, /publicUserWhere/);
  assert.match(search, /publicUserWhere/);
  assert.match(profile, /publicUserWhere/);
});

test("unverified cleanup is CRON_SECRET protected", () => {
  const route = read("app/api/cron/cleanup-unverified/route.ts");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /Bearer/);
  assert.match(route, /emailVerified: false/);
  assert.match(route, /24 \* 60 \* 60 \* 1000/);
});

test("admin metric overrides remain on public profile responses", () => {
  const route = read("app/api/users/[username]/route.ts");
  assert.match(route, /adminMetricOverride/);
  assert.match(route, /visibleCounts/);
  assert.match(route, /override\?\.followers/);
});

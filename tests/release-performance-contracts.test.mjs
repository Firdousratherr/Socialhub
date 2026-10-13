import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("public Android download defaults to the latest published Socialhub APK", () => {
  const helper = read("lib/app-download.ts");
  assert.match(helper, /releases\/latest\/download\/app-release\.apk/);
  assert.doesNotMatch(helper, /releases\/download\/v1\.1\.0\/app-release\.apk/);
});

test("legacy APK download route permanently redirects to the public download page", () => {
  const config = read("next.config.ts");
  assert.match(config, /source: "\/download-apk"/);
  assert.match(config, /destination: "\/download"/);
  assert.match(config, /permanent: true/);
});

test("Android releases use a persistent signing key and do not publish on every main push", () => {
  const workflow = read(".github/workflows/android-release-apk.yml");
  assert.match(workflow, /tags: \["v\*"\]/);
  assert.match(workflow, /secrets\.ANDROID_KEYSTORE_BASE64/);
  assert.match(workflow, /secrets\.ANDROID_KEYSTORE_PASSWORD/);
  assert.match(workflow, /secrets\.ANDROID_KEY_ALIAS/);
  assert.match(workflow, /secrets\.ANDROID_KEY_PASSWORD/);
  assert.match(workflow, /Missing required GitHub Actions secret/);
  assert.match(workflow, /startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.doesNotMatch(workflow, /openssl rand/);
});

test("third-party advertising script loads after the main page has loaded", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /import Script from "next\/script"/);
  assert.match(layout, /strategy="lazyOnload"/);
  assert.doesNotMatch(layout, /<script\s+nonce={nonce}\s+async/);
});

test("incoming-call polling is slower and avoids overlapping background requests", () => {
  const shell = read("components/app-shell.tsx");
  const poll = read("hooks/use-live-poll.ts");
  assert.match(shell, /}, 2500, Boolean\(session\?\.user\?\.id\)\)/);
  assert.match(poll, /runningRef\.current/);
  assert.match(poll, /document\.visibilityState !== "visible"/);
  assert.match(poll, /navigator\.onLine === false/);
});

test("PostgreSQL SSL mode is explicit to avoid repeated driver warnings", () => {
  const prisma = read("lib/prisma.ts");
  assert.match(prisma, /function normalizeDatabaseSslMode/);
  assert.match(prisma, /\["prefer", "require", "verify-ca"\]/);
  assert.match(prisma, /url\.searchParams\.set\("sslmode", "verify-full"\)/);
});

test("non-recommended feed requests parallelize independent database lookups", () => {
  const posts = read("app/api/posts/route.ts");
  assert.match(posts, /const \[nextBlockedIds, nextMutedIds, friendRows, followingRows\] = await Promise\.all/);
  assert.match(posts, /const \[displayCounts, likedRows, savedRows\] = await Promise\.all/);
});

test("public trend candidates are cached briefly without leaking blocked-user content", () => {
  const trends = read("app/api/discover/trends/route.ts");
  assert.match(trends, /unstable_cache/);
  assert.match(trends, /revalidate: 60/);
  assert.match(trends, /select: \{ authorId: true, content: true \}/);
  assert.match(trends, /blockedSet\.has\(post\.authorId\)/);
});

test("home feed parses independent API responses concurrently", () => {
  const home = read("components/home-feed.tsx");
  assert.match(home, /const \[feedJson, storyJson, usersJson, trendsJson\] = await Promise\.all/);
});

test("story access lookups run concurrently", () => {
  const stories = read("app/api/stories/route.ts");
  assert.match(stories, /const \[nextBlockedIds, friendRows\] = await Promise\.all/);
});

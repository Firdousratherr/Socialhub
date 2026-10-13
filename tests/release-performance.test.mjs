import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("public APK download defaults to the latest published Android release", () => {
  const source = read("lib/app-download.ts");
  assert.match(source, /releases\/download\/v1\.1\.1\/app-release\.apk/);
  assert.doesNotMatch(source, /releases\/download\/v1\.1\.0\/app-release\.apk/);
});

test("legacy download-apk URL redirects to the public download page", () => {
  const route = read("app/download-apk/page.tsx");
  assert.match(route, /redirect\("\/download"\)/);
});

test("release builds use a persistent configured signing key, not a generated key", () => {
  const workflow = read(".github/workflows/android-release-apk.yml");
  assert.match(workflow, /ANDROID_KEYSTORE_BASE64/);
  assert.match(workflow, /ANDROID_KEYSTORE_PASSWORD/);
  assert.match(workflow, /ANDROID_KEY_PASSWORD/);
  assert.match(workflow, /ANDROID_KEY_ALIAS/);
  assert.match(workflow, /keytool -list/);
  assert.doesNotMatch(workflow, /openssl rand/);
  assert.match(workflow, /tags:/);
  assert.match(workflow, /github\.event_name == 'push'/);
});

test("expensive call/admin UI is loaded only when that part of the product is used", () => {
  const shell = read("components/app-shell.tsx");
  const pages = read("components/social-pages.tsx");
  assert.match(shell, /dynamic\(\(\) => import\("@\/components\/call-panel"\)/);
  assert.match(pages, /dynamic\([\s\S]*?import\("@\/components\/admin-workspace"\)/);
  assert.match(pages, /dynamic\([\s\S]*?import\("@\/components\/call-panel"\)/);
  assert.doesNotMatch(shell, /import CallPanel, \{ type WebCall \} from "@\/components\/call-panel"/);
  assert.doesNotMatch(pages, /import \{ AdminWorkspace \} from "@\/components\/admin-workspace"/);
});

test("website realtime inbox polling is less aggressive while hidden tabs remain paused", () => {
  const shell = read("components/app-shell.tsx");
  assert.match(shell, /}, 2500, Boolean\(session\?\.user\?\.id\)\)/);
});

test("hosted social images use the image optimizer at display-sized resolutions", () => {
  const config = read("next.config.ts");
  const helper = read("lib/social-image.ts");
  const feed = read("components/home-feed.tsx");
  const pages = read("components/social-pages.tsx");
  const stories = read("components/story-center.tsx");

  assert.match(config, /remotePatterns/);
  assert.match(config, /public\.blob\.vercel-storage\.com/);
  assert.match(config, /googleusercontent\.com/);
  assert.match(helper, /canOptimizeSocialImage/);
  assert.match(feed, /unoptimized=\{!canOptimizeSocialImage\(post\.mediaUrl\)\}/);
  assert.match(feed, /sizes="\(max-width: 640px\) calc\(100vw - 2rem\), 520px"/);
  assert.match(pages, /sizes=\{imageSizes\[size\]\}/);
  assert.match(stories, /unoptimized=\{!canOptimizeSocialImage\(active\.mediaUrl\)\}/);
});

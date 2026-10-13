import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("public Android download defaults to the latest published Socialhub APK", () => {
  const helper = read("lib/app-download.ts");
  assert.match(helper, /releases\/download\/v1\.1\.1\/app-release\.apk/);
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

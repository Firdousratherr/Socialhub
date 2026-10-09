import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("download page exposes one direct APK button and reserves bottom-nav space", () => {
  const page = read("app/download/page.tsx");
  const css = read("app/globals.css");
  assert.match(page, /href={downloadUrl}/);
  assert.match(page, /download="Socialhub\.apk"/);
  assert.match(page, /Download APK/);
  assert.match(page, /safe-area-inset-bottom/);
  assert.match(page, /pb-\[calc\(11rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(page, /relative z-\[70\]/);
  assert.match(css, /body:has\(\.download-page-root\) \.social-bottom-nav\s*\{\s*display:\s*none !important;/);
  assert.doesNotMatch(page, /release information|admin-configurable|CheckCircle2|ShieldCheck/i);
});

test("download page is publicly accessible without a session", () => {
  const routePolicy = read("lib/route-policy.ts");
  assert.match(routePolicy, /"\/download"/);
});

test("download links reject insecure and non-APK configured URLs", () => {
  const helper = read("lib/app-download.ts");
  assert.match(helper, /url\.protocol === "https:"/);
  assert.match(helper, /\.apk\$\/i/);
  assert.match(helper, /DEFAULT_ANDROID_APK_URL/);
});

test("the global APK footer stays above the fixed mobile navigation", () => {
  const footer = read("components/app-download-footer.tsx");
  assert.match(footer, /pb-\[calc\(var\(--mobile-nav-h\)\+env\(safe-area-inset-bottom\)\+1rem\)\]\s+sm:pb-0/);
  assert.match(footer, /w-full[^"]*sm:w-auto/);
  assert.match(footer, /href="\/download"/);
});

test("the global footer is suppressed on the dedicated APK page", () => {
  const footer = read("components/app-download-footer.tsx");
  assert.match(footer, /usePathname/);
  assert.match(footer, /pathname === "\/download"/);
  assert.match(footer, /return null/);
});

test("password recovery searches emails case-insensitively and sends to stored address", () => {
  const route = read("app/api/auth/request-password-reset/route.ts");
  assert.match(route, /trim\(\)\.toLowerCase\(\)/);
  assert.match(route, /findFirst/);
  assert.match(route, /mode: "insensitive"/);
  assert.match(route, /body: \{ email: user\.email \}/);
  assert.match(route, /count: \{ increment: 1 \}/);
  assert.match(route, /return NextResponse\.json\(\{ success: true \}\)/);
});

test("Better Auth reset-password OTP uses the account's canonical email", () => {
  const route = read("app/api/auth/[...all]/route.ts");
  assert.match(route, /email-otp\/reset-password/);
  assert.match(route, /mode: "insensitive"/);
  assert.match(route, /email: user\.email/);
  assert.match(route, /handlers\.POST\(normalizedRequest\)/);
});

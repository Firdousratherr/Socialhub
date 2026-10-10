import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("browser media permissions are limited to the Socialhub origin", () => {
  const proxy = read("proxy.ts");
  const config = read("next.config.ts");
  const callPanel = read("components/call-panel.tsx");

  assert.match(proxy, /camera=\(self\), microphone=\(self\)/);
  assert.match(proxy, /geolocation=\(\), browsing-topics=\(\)/);
  assert.doesNotMatch(config, /camera=\(\), microphone=\(\)/);
  assert.match(callPanel, /navigator\.mediaDevices\.getUserMedia/);
});

test("AdSense and Next.js scripts receive a fresh per-request CSP nonce", () => {
  const proxy = read("proxy.ts");
  const layout = read("app/layout.tsx");
  const config = read("next.config.ts");

  assert.match(proxy, /Buffer\.from\(randomUUID\(\)\)\.toString\("base64"\)/);
  assert.match(proxy, /requestHeaders\.set\("x-nonce", nonce\)/);
  assert.match(proxy, /script-src 'nonce-\$\{nonce\}'.*'strict-dynamic'/);
  assert.match(proxy, /requestHeaders\.set\("Content-Security-Policy", csp\)/);
  assert.match(proxy, /response\.headers\.set\("Content-Security-Policy", csp\)/);
  assert.match(layout, /headers\(\)\)\.get\("x-nonce"\)/);
  assert.match(layout, /nonce=\{nonce\}/);
  assert.doesNotMatch(config, /Content-Security-Policy/);
});

test("CSP keeps essential restrictions while supporting Socialhub media and calls", () => {
  const proxy = read("proxy.ts");

  for (const directive of [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:",
    "media-src 'self' blob: https:",
    "upgrade-insecure-requests",
  ]) {
    assert.ok(proxy.includes(directive), `Missing CSP directive: ${directive}`);
  }
});

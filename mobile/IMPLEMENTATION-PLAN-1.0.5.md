# Socialhub Android 1.0.5 Implementation Plan

## Phase 1 — Branding and release identity (implemented)
- Replace the Android launcher/app branding asset with the new Socialhub sparkle gradient logo.
- Use a dedicated monochrome notification icon instead of the full-color launcher artwork.
- Update Android app version from 1.0.4 to 1.0.5.
- Increment Android versionCode from 5 to 6.
- Keep the existing safe-area and keyboard layout configuration intact while branding is changed.
- Make push registration read the app version from mobile/app.json so future releases cannot silently report a stale version.

## Phase 2 — Android quality gates (implemented)
- Make Expo Doctor a blocking CI check.
- Add a native Android prebuild to the standard mobile CI path.
- Add a Gradle debug APK build to CI so TypeScript/config success cannot hide native Android build failures.
- Keep Vercel deployment outside this Android validation workflow.

## Phase 3 — UI/UX audit (next)
Audit every mobile screen against the website and current Android screenshots:
- Status-bar and safe-area coverage on small and tall Android screens.
- Header height, logo visibility, navigation drawer, and bottom navigation.
- Keyboard behavior for messages and comments.
- Loading, empty, offline, retry, and failure states.
- Image/video rendering, media composer, story viewer, and profile editing.
- Accessibility: touch target size, readable text, contrast, dynamic font behavior, and back navigation.
- Deep links from notifications into the exact post/story/message/profile target.

## Phase 4 — Communication features (next)
- Typing indicators with explicit real-time events and lifecycle cleanup.
- Message reaction picker and reaction counts.
- Read receipts and unread synchronization.
- Better attachment progress/retry handling.
- Conversation mute/archive state synchronization.
- Push notification deep links to the exact destination.

## Phase 5 — Reliability and offline behavior (next)
- Request timeout and retry policy for transient network failures.
- Pull-to-refresh and explicit retry controls where missing.
- Safer realtime polling backoff when the server or network is unavailable.
- Session-expiry recovery without losing unsent composer text.
- Prevent duplicate actions when a request is still pending.

## Phase 6 — Release hardening (before public release)
- Verify release signing uses a durable keystore; do not rotate signing keys between releases.
- Validate launcher icon, notification icon, splash screen, package name, versionCode/versionName, permissions, deep links, and notification delivery on a physical Android device.
- Produce a release APK/AAB only after CI is green.
- No Vercel deployment is performed by this Android implementation branch.

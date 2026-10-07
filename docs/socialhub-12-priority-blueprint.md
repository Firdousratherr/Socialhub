# Socialhub — 12-Priority Implementation Blueprint

This branch carries the unified product roadmap. Existing systems are retained and extended instead of duplicated.

## 1. Core Experience — P0
- Stable feed loading, retry, pagination and server-side drafts.
- Stable Stories composer/viewer and graceful media errors.
- Discover crash isolation and empty/error states.
- Keyboard-safe messaging UI.
- Reliable navigation/back handling.
- Calls: 1-to-1 audio/video with permission-aware UX.

## 2. Social Graph — P0
- Friends, followers, following, requests, suggestions.
- Mutual connections.
- Follow/unfollow/remove/block/mute/restrict.
- Prevent duplicate suggestions after connection changes.

## 3. Content — P0
- Posts, multi-media foundation, visibility.
- Reactions, comments and replies.
- Save/share/pin/edit/delete.
- Stories with reactions/replies/viewers.

## 4. Search & Discovery — P0
- People/posts/hashtags search.
- Trending topics.
- Personalized For You ranking.
- Recent/live result refresh.
- Search-safe blocked/muted filtering.

## 5. Privacy & Security — P0
- Private accounts.
- Message/friend-request controls.
- Active-status control.
- Session/device security.
- Email OTP, password recovery and 2FA.

## 6. Trust & Safety — P0
- User/post/comment/story/message reporting.
- Moderator queue and priorities.
- Blocks/mutes/restrictions.
- Audit trail for enforcement.

## 7. Admin Control Center — P0
- Users, content, reports, verification, analytics.
- Feature flags and platform settings.
- Announcements.
- Security, audit and storage controls.
- Product priority health view.

## 8. Web + Android Parity — P0
- Shared API contracts and feature behavior.
- Safe areas and keyboard handling.
- Deep links.
- Push notifications.
- Calling controls on both platforms.

## 9. Realtime — P0
- Presence.
- Realtime event queue.
- Message updates.
- Notifications.
- Incoming-call events/signaling.
- Polling fallback with bounded cursors.

## 10. Media — P1
- Blob-backed uploads with content sniffing and quotas.
- Media asset inventory.
- Upload usage accounting.
- Image/video metadata foundation.
- Cleanup of abandoned assets.

## 11. Smart Social Features — P1
- For You ranking using relationships, engagement and recency.
- Recommendation events.
- Trend-aware discovery.
- Future ML ranking can replace the deterministic scorer without changing clients.

## 12. Creator & Monetization Foundation — P2
- Creator profile state.
- Subscription/membership data model.
- Creator analytics foundation.
- No payment processor is activated by default.
- Payment activation must remain feature-gated and auditable.

## Release gates
1. Web typecheck/lint/build.
2. Prisma schema validation/generation.
3. Android dependency/configuration validation.
4. Calling permission and media-path review.
5. No production deploy until preview is green.

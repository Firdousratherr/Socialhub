# Facebook-style Messaging & Mobile Navigation Blueprint

## Goal

Make Direct Messages a first-class mobile destination and make conversations feel live instead of requiring manual refreshes.

## Phase 1 — Mobile navigation

- Add a persistent mobile bottom navigation bar.
- Put **Messages** in the center as a primary destination.
- Include Home, Friends, Messages, Notifications and Profile.
- Highlight the active destination.
- Respect mobile safe-area insets and keep page content clear of the fixed bar.
- Keep the existing desktop/mobile menu for secondary navigation.

## Phase 2 — Live conversation updates

- Refresh the active conversation on a short 2-second cadence.
- Refresh the conversation list every 5 seconds so new messages and unread counts appear without navigating away.
- Preserve the user's scroll position when they are reading older content.
- Automatically move to the newest message only when the user is already near the bottom.
- Continue using cursor pagination for older history.

## Phase 3 — Typing presence

- Add a lightweight per-conversation typing-presence endpoint.
- Typing state expires automatically after a few seconds.
- Publish a heartbeat while the composer contains text.
- Poll presence every 2 seconds.
- Never let presence failures block sending or receiving messages.
- Do not store message content as typing metadata.

## Phase 4 — Facebook-style conversation polish

- Show animated typing indicator.
- Show message timestamps.
- Show direct-message read state (Seen) using existing lastReadAt.
- Keep existing reactions, replies, editing, deletion, attachments, archive and mute controls.
- Avoid disrupting older-message loading.

## Phase 5 — Quality and regression protection

- Add contract tests for bottom navigation, polling, typing endpoint and read receipts.
- Run schema validation, TypeScript, repository smoke tests, blueprint contracts, ESLint and production build.
- Review the final diff for accidental API/security regressions.
- No manual Vercel deployment.

## Implementation note

The repository currently uses Next.js/Vercel-compatible request handlers rather than a dedicated WebSocket infrastructure. The live behavior therefore uses short-interval database-backed polling and expiring typing presence. This provides near-real-time behavior without introducing a separate realtime service or long-lived socket dependency.

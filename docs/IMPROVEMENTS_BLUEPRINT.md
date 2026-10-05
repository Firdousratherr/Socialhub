# Socialhub — 2026 Improvement Blueprint

Audit date: 5 October 2026
Baseline: main @ 9a7586f
Deployment policy: no intentional Vercel deployment during this work.

## Audit summary
The backend is already comparatively mature: Better Auth with email OTP/2FA, centralized social-access checks, permission-gated admin APIs, Zod validation for core mutations, runtime feature flags, announcements, moderation cases, risk signals, appeals, approvals, audit logs, and database-backed rate limiting.
The highest-value remaining work is consistency: surface existing admin controls to users, remove hard-coded mock data, normalize API hardening, consolidate duplicated admin UIs, and add browser-level regression coverage.

## Implemented in this branch
1. Root route error recovery UI and navigation loading state.
2. Same-tab live-sync source IDs to avoid duplicate event delivery.
3. Home feed trend data is sourced from the live trends endpoint instead of fabricated counters.
4. User-visible platform announcements with local dismissal.
5. Server-side audience filtering for VERIFIED and MODERATORS announcements.
6. Blocked-account management and direct unblock from Settings.
7. Rate-limited account-data JSON export.
8. Rate limit on direct block/unblock actions.

## User roadmap
### U1 — Trust and communication
Quiet hours, muted accounts/keywords, Close Friends audiences, message requests, accessible report dialogs.
### U2 — Publishing and media
Cloud drafts, multi-photo/video posts, repost/quote posts, Saved collections, full-screen media viewer, paginated hashtag pages.
### U3 — Social graph and messaging
Group roles/invites, message search, pinned messages, read receipts, mention autocomplete, better mutual-connection suggestions.
### U4 — Privacy and lifecycle
Queued/streaming large exports, export history, deletion workflow, retention controls, passkeys/WebAuthn.

## Admin roadmap
### A1 — Unified admin information architecture
Converge AdminPanel, AdminWorkspace, AdminControlCenter and AdminIntelligencePanel into one navigation model while retaining the existing permission-gated APIs.
Sections: Overview, People/User 360, Content, Reports/Moderation, Messaging, Verification, Cases/Enforcement/Appeals/Approvals, Risk/Integrity, Analytics, Platform Controls, Audit/Export.
### A2 — Operational command center
Saved views, bulk dry runs, reason-required enforcement, scheduled incident mode, staged feature rollouts, audience preview for announcements, storage quota analytics.
### A3 — Trust and safety
Report clustering, case grouping, SLA queues, per-user risk history, moderator workload analytics, abuse-pattern detection, high-risk approval gates.
### A4 — Governance
Immutable audit export, admin 2FA enforcement, permission templates, separation of duties, before/after diffs, privacy/deletion request queue.

## Code/security backlog
1. Consistent server-side validation on every state-changing endpoint.
2. Targeted limits on reactions, follows, reports, saves, shares and other spam-prone mutations.
3. Atomic rate-limit increments under concurrency.
4. Standardized API error envelopes and request IDs.
5. GET-handler write audit.
6. Upload signature/MIME/size validation.
7. Pagination/cost caps on admin/search/export.
8. Replace browser confirm/prompt/alert with accessible dialogs/toasts.

## UI/accessibility backlog
Preserve 44px touch targets; prevent sticky navigation from obscuring focus; maintain strong visible focus states; use semantic controls; make dialogs focus-safe; finish dark-theme contrast review; add mobile regression coverage.

## QA gates
Current CI covers install, DB validation, TypeScript, repository smoke contracts, blueprint contracts, lint, and production build. The repository still needs true browser E2E coverage.
Target release gate: unit tests, API contract tests, Playwright smoke tests for auth/feed/stories/discover/friends/messages/notifications/settings/admin, desktop + mobile viewports, accessibility assertions, and screenshots on failure.

## Definition of done
GitHub CI green; typecheck/lint/build green; core API tests green; browser smoke tests green; no user-facing mock data; destructive actions guarded/audited; admin permissions match visible UI; Vercel deployment only after all gates pass.
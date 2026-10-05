# Socialhub Planned Improvements Blueprint — 2026-10-05

## Audit baseline

Repository: `Firdousratherr/Socialhub`
Baseline: main at `eb08056415e44e31c23170142c236ba4468f958a`
Working branch: `audit-improvements-2026-10-05-v2`
Deployment policy: **No Vercel deployment or promotion is part of this work.**

The audit covered the App Router route map, API handlers, Prisma schema/migrations, Better Auth boundaries, admin authorization, social access helpers, rate limiting, feed/notification flows, upload flows, live-sync hooks, responsive navigation, settings/profile surfaces, and existing repository contract tests.

## Executive findings

Socialhub is already a mature social-network codebase rather than a starter project. The high-value work is now consistency, abuse resistance, UX reliability, and exposing additional controls without duplicating business rules.

The most important issues found were:

1. **Rate limiting was not atomic under concurrency.** The old read-then-write bucket path could race when multiple requests hit the same key. This matters for actions such as posting, reactions, follows, reports and other high-volume mutations.
2. **Next.js 16 migration debt remained.** The project uses Next.js 16 and still had the deprecated `middleware.ts` convention. The network boundary is now migrated to `proxy.ts`.
3. **Mutation throttling was uneven.** Some social actions had access checks but no targeted rate-limit policy.
4. **Muted-account behavior was missing.** Blocking existed, but users lacked the softer control to remove an account from their feed/notification experience without blocking it.
5. **Admin bulk actions needed a preview step.** The administrator workspace could execute multi-user changes directly; a dry-run preview is safer for high-impact operations.
6. **Browser-native prompts/confirms remain in legacy/core surfaces.** They are functional but are a UI/a11y debt and should be replaced with accessible in-app dialogs in the next pass.
7. **Admin UI still contains broad `any` typing and a large monolithic workspace.** This increases regression risk even though it is not itself a runtime error.
8. **Large export/search/admin data paths still need stronger operational caps and pagination discipline before scale increases.**

## Implemented in this branch

### P0 — reliability/security
- Replaced the deprecated Next.js 16 `middleware.ts` convention with `proxy.ts`.
- Added an `X-Request-ID` response header at the API boundary for correlation.
- Reworked the database-backed rate limiter to use an atomic PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` counter.
- Added targeted throttles to like, reaction, save, share, report, story, notification-preference and account-mute mutations.
- Added durable account mutes with indexed Prisma storage and cascade-safe foreign keys.
- Feed and notification reads now suppress muted accounts without affecting the relationship itself.

### P1 — user experience
- Added **Mute / Unmute** to profile actions.
- Added a **Muted accounts** management surface in Settings.
- Kept blocking separate from muting so users can choose the appropriate level of control.

### P1 — admin operations
- Added an **Admin bulk dry-run** endpoint and UI preview.
- Dry runs report requested, eligible, missing and owner-protected accounts without changing data.
- Existing audited write behavior remains unchanged for the final operation.

### QA contracts
- Added regression contracts for the proxy boundary, atomic rate limiting, mute enforcement, targeted throttles, and admin dry runs.

## Next implementation phases

### Phase 2 — interaction UX and accessibility
Replace `window.confirm`, `window.prompt`, and `window.alert` in profile, feed, stories, settings, and admin surfaces with reusable focus-trapped dialogs and non-blocking status toasts.

Required behavior:
- Escape closes dialogs.
- Focus moves into the dialog and returns to the trigger.
- Destructive actions have explicit labels.
- Reports use a real reason form with validation.
- Touch targets stay at least 44px.
- Focus-visible states remain visible on light and dark themes.

### Phase 3 — richer user controls
Add:
- notification quiet hours with timezone-aware scheduling;
- message requests;
- muted keywords;
- Close Friends audience;
- saved collections;
- multi-media posts;
- quote/repost;
- message search, pinned messages and read receipts;
- mention autocomplete;
- improved mutual-connection suggestions.

### Phase 4 — admin command center
Consolidate the current workspace into one operational IA:
- Overview
- People
- Content
- Reports
- Messaging
- Verification
- Cases / Enforcement / Appeals / Approvals
- Risk / Integrity
- Analytics
- Platform Controls
- Audit / Export

Add saved admin views, bulk dry-run + reason requirements, staged feature rollout percentages, announcement previews, storage/quota analytics, moderator workload, SLA queues, report clustering, and before/after diffs.

### Phase 5 — governance and privacy
Add:
- immutable audit export chain/checksums;
- mandatory admin 2FA enforcement;
- permission templates / separation of duties;
- export history and resumable large exports;
- deletion workflow and retention controls;
- passkeys/WebAuthn.

### Phase 6 — performance and maintainability
- Split the large `social-pages.tsx` and `admin-workspace.tsx` files into domain components.
- Remove broad `any` types from admin data models.
- Standardize API error envelopes and request IDs.
- Add pagination/cost caps to every high-volume admin/search/export path.
- Tighten upload MIME/size/signature validation.
- Replace raw `<img>` usage with `next/image` where appropriate and safe.
- Add browser-level Playwright coverage for auth, feed, stories, discover, friends, messages, notifications, settings and admin desktop/mobile flows.

## Verification gates

Before any Vercel deployment is considered, the branch must pass:

1. Prisma schema validation and generation.
2. TypeScript typecheck.
3. Repository contract tests.
4. ESLint.
5. Next.js production build.
6. Browser smoke/a11y coverage for critical flows.
7. Manual review of admin permission boundaries and destructive operations.
8. No remaining P0/P1 regression.

Vercel deployment remains a separate, explicit step after these gates.

## Research basis

The roadmap follows current Next.js 16 guidance for the `proxy.ts` network-boundary convention and current OWASP API Security guidance emphasizing object-level authorization, function-level authorization, input limits, and tailored rate limiting for resource-intensive or automatable business flows.

Reference areas:
- Next.js 16 upgrade/proxy guidance
- Next.js App Router Proxy reference
- OWASP API Security Top 10 (especially API1, API4, API5 and API6)
- WCAG 2.2 focus visibility and operable touch/keyboard interaction guidance

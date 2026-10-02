# Socialhub — Production Hardening & Control Center Implementation Plan

## Objective
Complete the next production-hardening pass identified in the October 2, 2026 main-branch audit without triggering a Vercel deployment.

## Phase 1 — Authorization and admin security
- Enforce the existing AdminPermission model at API boundaries.
- Add centralized permission helpers and a moderator-permission management endpoint.
- Separate view, mutation, export, security, messaging, moderation, verification, and platform permissions.
- Add audit coverage for permission changes.
- Prepare step-up/2FA integration using Better Auth's current two-factor plugin surface.

## Phase 2 — User lifecycle and real profile analytics
- Add suspension metadata, deletion metadata, password-reset flags, and server-side inactive-session protection.
- Add authenticated profile-view events with daily de-duplication.
- Expose real profile-view totals in profile/admin APIs.
- Revoke sessions when an account is disabled.

## Phase 3 — Abuse, CSRF and platform security
- Add same-origin protection for custom state-changing APIs.
- Add database-backed generic rate limiting for high-cost/social mutation endpoints.
- Tighten production CSP.
- Keep upload quotas and content-signature validation.
- Add stronger account-deletion safeguards.

## Phase 4 — Moderation, messaging and storage operations
- Add admin moderation endpoints for comments/stories/story replies.
- Add storage usage reporting and orphan cleanup support.
- Expand admin message/search controls with explicit permission enforcement.

## Phase 5 — Runtime platform controls and analytics
- Add runtime feature-flag/settings helpers.
- Add time-series admin analytics.
- Add announcement lifecycle controls at the API level.

## Phase 6 — Quality gate
- Add ESLint/Next Core Web Vitals configuration.
- Extend contract tests for authorization, lifecycle, profile views, CSRF and rate limits.
- Update repository smoke checks and operational documentation.
- Run schema validation, typecheck, tests, lint and production build in CI.

## Deployment boundary
GitHub/CI only. Do not trigger a Vercel deployment.

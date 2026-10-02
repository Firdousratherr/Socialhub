# Socialhub Repository Reconciliation

Last branch audit: 2026-10-02

## Authoritative line

Current `main` is the authoritative development line.

The final branch audit compared every remaining branch against `main`. No stale branch was merged wholesale because the divergent branches were based on older application states and their changes overlap with newer implementations already consolidated into `main`.

## Audit outcome

- 31 non-main branches were reviewed against current `main`.
- 25 branches were divergent.
- 6 branches were strictly behind with zero commits ahead of `main`.
- No open pull requests remained.
- Current `main` contained the active implementations for authentication, profiles, privacy, friends/follows, messaging, notifications, stories, discovery, moderation, uploads, verification, and admin authorization.

## Zero-ahead historical branches

These had no commits ahead of `main` at the final audit point:

- `feature/admin-inspection`
- `feature/core-social-screens`
- `feature/production-auth-google`
- `feature/socialhub-phase14-settings-security`
- `feature/socialhub-phase15-stories-2`
- `feature/verification-owner-system`

They are historical references only and do not form part of the active development path.

## Large divergent branches

The largest divergent branches were also inspected for functionality overlap. Their commits were not merged as branch histories:

- `feature/code-audit-hardening-admin`
- `feat/production-completion-phases`
- `feature/core-social-upgrade`
- `fix/full-production-hardening`
- `fix/production-hardening`
- `feat/final-production-completion`

The important rule is to recover a specific missing capability only after verifying that it is absent from `main`; never merge an old production branch wholesale.

## Development policy from this point

1. `main` is the single source of truth.
2. New feature work uses short-lived feature branches.
3. Changes merge through pull requests after CI passes.
4. CI runs on `main` and pull requests targeting `main`.
5. Historical branches must not be treated as alternate production lines.
6. Production deployment verification is separate from source/CI verification.

## Deployment note

At the final audit point, GitHub reported the Vercel check for the current `main` commit as failing with a Vercel build-rate-limit destination. This is a deployment-capacity issue, not evidence that the branch reconciliation itself failed.

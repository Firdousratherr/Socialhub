# Admin Control Center Blueprint

## Goal
Expand the Socialhub admin panel from moderation/user inspection into a controlled, auditable operations center. Metric overrides are administrative display controls; they do not fabricate database activity.

## Phase 1 — User metrics control
- Add a **Profile metrics** section inside User 360.
- Show live database values beside current admin override values.
- Allow administrators to override:
  - Posts
  - Followers
  - Following
  - Likes received
  - Comments received
  - Shares
  - Profile views
- Accept only non-negative integers up to 1,000,000,000.
- Allow individual fields to be reset to live values.
- Allow all metric overrides to be cleared at once.
- Keep the existing `AdminMetricOverride` model as the persistence layer.

## Phase 2 — Public profile integration
- Public and own profile APIs resolve the configured display metrics.
- Existing real relationships and post data remain real database records.
- Manual metric overrides affect profile summary counters only.
- Relationship actions do not silently rewrite administrator-defined overrides.

## Phase 3 — Account controls
- Surface email-verification and privacy controls in User 360 using the existing audited user PATCH endpoint.
- Preserve owner/admin safety rules already enforced server-side.
- Keep role, activation, verification, and ownership protections intact.

## Phase 4 — Auditability and safety
- Metric changes are restricted to administrator accounts.
- Every metric change records before/after values in `AdminAuditLog`.
- Clearing overrides is explicitly represented as a reset action.
- API validation rejects negative, fractional, oversized, or malformed values.
- Do not expose admin override fields through unrelated public endpoints.

## Phase 5 — Verification
- Add contract tests for metric validation, admin-only metric control, audit logging, reset behavior, and public `visibleCounts` resolution.
- Run database validation, typecheck, tests, and production build through CI.
- Fix any failures before merge.
- Merge the completed PR into `main`.

## Deployment boundary
This change is GitHub/CI-only. **Do not trigger a Vercel deployment as part of this work.**

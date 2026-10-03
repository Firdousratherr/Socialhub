# Socialhub Discover Search + Admin Control Polish Blueprint

## Findings from current code and supplied mobile screenshots

### Discover/search issue
The Discover People surface renders `user._count.followers` directly. The profile API already supports administrator-controlled public metric overrides through `AdminMetricOverride`, but `GET /api/users` did not expose those display counts. This creates an inconsistency: a profile can show an administrator-configured follower count while search results reveal the raw database follower count.

### Admin UI findings
The admin Control Center already contains the underlying capabilities for security, global search, platform settings, feature flags, announcements, analytics, storage, permissions, and system health. The main usability gaps are:
- high-value controls require manually entering raw setting/flag keys;
- announcement records are mostly display-only even though the API already supports update/delete operations;
- moderator permissions are powerful but have no role presets;
- the dense control layout is difficult to scan and use on mobile;
- public metric controls are separated from the rest of the operating workflow.

## Implementation

### Phase 1 — Consistent public search metrics
- Extend `GET /api/users` with server-authoritative `displayCounts` sourced from `AdminMetricOverride`.
- Preserve raw `_count` values for internal correctness.
- Update Discover to display `displayCounts.followers`.
- Keep compact K/M/B formatting and exact-count accessibility context.
- Apply the same relationship-aware filtering to suggestion-mode results.

### Phase 2 — Admin quick controls
Add a curated quick-control panel for existing supported runtime settings:
- Registration enabled/disabled.
- Feature-flag quick toggling from existing saved flags.
- Clear labels explaining which controls take effect immediately.
These controls use the existing `systemSetting` and `featureFlag` APIs; no unsupported setting is invented.

### Phase 3 — Announcement lifecycle controls
Expose the API capabilities already present:
- Publish/unpublish state.
- Archive.
- Delete.
- Edit title/body/audience/schedule.
Keep all changes audited.

### Phase 4 — Moderator permission presets
Add reusable presets backed by the existing permission enum:
- Content moderator.
- Safety & reports moderator.
- Community moderator.
- Full operations moderator.
Presets populate the existing permission matrix before saving; administrator accounts retain full access.

### Phase 5 — Admin visual polish
- Improve responsive tab navigation and section hierarchy.
- Add compact status summaries and clear destructive-action styling.
- Improve mobile spacing and touch targets.
- Keep all sensitive actions behind the existing server permission boundaries.

### Phase 6 — Regression gate
Add tests for:
- public search using display follower counts;
- raw versus display count separation;
- quick control actions using supported keys;
- announcement lifecycle controls;
- moderator permission presets.
Run database validation, typecheck, repository integrity, contract tests, lint, and production build.

## Acceptance criteria
- Discover search never leaks raw follower counts when a public display override exists.
- Search shows the same public follower metric as the profile.
- K/M/B formatting remains consistent.
- Admin can control registration without editing environment variables.
- Admin can manage announcement lifecycle from the UI.
- Moderator permissions can be applied using named presets.
- Existing security, moderation, audit, analytics, storage, messaging, and live UI behavior remain intact.
- No Vercel deployment is initiated during implementation; merge only after final CI passes.

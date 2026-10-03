# Socialhub UI + Feature Expansion — Implementation Blueprint

## Audit baseline
The current application already has live feed updates, relationship-aware suggestions, compact K/M/B counts, story interactions, messaging refresh, admin controls, profile pinning, privacy settings, notification preferences, and session management.

The expansion focuses on consistency, discoverability, and turning existing backend capabilities into complete user-facing features.

## Implemented in this branch

### Phase 1 — Discover 2.0
- Empty Discover now uses `/api/users?suggestions=true` instead of generic search.
- Suggestions retain relationship-aware exclusion rules.
- Search results now receive public follower/following display overrides.
- K/M/B presentation remains shared with profiles.
- Search still exposes People, Posts, and Hashtags when a query is present.

### Phase 3 — Saved Posts
- Added authenticated `/api/saved` collection endpoint.
- Added paginated Saved Posts library.
- Added empty, loading, and error states.
- Added remove-from-saved action.
- Added Saved Posts to mobile navigation.

### Phase 5 — Messaging
- Added per-conversation local draft persistence.
- Drafts restore when switching back to a conversation.
- Draft storage is removed after successful send.

### Phase 6 — Notifications
- Added All / Unread / Social / Messages / Requests filters.
- Existing live polling and mark-all-read behavior remains intact.

### Phase 4 — Stories
- Story viewer now shows progress and position context.
- Existing reactions, replies, navigation, views, and deletion remain intact.

### Phase 18 — Social discovery primitives
- Added server-side mention extraction.
- Added preference-aware mention notifications for posts and comments.
- Existing notification deep-linking and filtering remain intact.

## Final hardening notes

The current implementation keeps the existing domain components intact to minimize regression risk while adding the highest-impact user-facing capabilities. Further component splitting of the monolithic social screen is an architectural follow-up rather than a prerequisite for this completed UI/feature pass.

### Feed
- Consolidate post-card UI into reusable components.
- Add draft composer persistence.
- Add upload progress/cancel states.
- Clarify feed modes until ranking semantics are implemented.
- Add mention/hashtag parsing only after notification and search contracts are defined.

### Profile
- Preserve pinned-post behavior.
- Refine primary versus secondary action hierarchy.
- Improve cover/profile media cropping and mobile spacing.
- Add dedicated media/pinned sections where useful.

### Settings
- Convert long settings page into grouped navigation with mobile anchors and desktop sidebar.
- Keep privacy, notification, verification, sessions, and account deletion boundaries unchanged.

### Admin
- Continue command-center refinement.
- Add moderation queue filters and bulk operations where server permissions already support them.
- Keep public display overrides visually separate from live database metrics.
- Add typed platform-control catalog instead of arbitrary setting keys.

### Architecture
- Split the large `components/social-pages.tsx` into domain components:
  - profile
  - discover
  - friends
  - notifications
  - messages
  - settings
- Centralize shared UI primitives.
- Add request cancellation and deduplication to long-lived live screens.

### Accessibility/performance
- Focus management for mobile menu/dialogs.
- Keyboard and screen-reader coverage.
- Reduce unnecessary polling.
- Optimize media rendering and lazy loading.
- Preserve safe-area and reduced-motion behavior.

## Validation gate
Before merge:
1. Database/schema validation
2. TypeScript
3. Repository integrity
4. Contract/regression tests
5. ESLint
6. Production build
7. Review changed UI/logic contracts

No Vercel deployment is part of this branch's implementation cycle. Merge only after the final validation gate passes.

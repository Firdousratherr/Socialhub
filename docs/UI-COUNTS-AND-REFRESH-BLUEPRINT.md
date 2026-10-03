# Socialhub UI Refresh + Social Count Blueprint

## Research scope
Audited the current `main` implementation at the post/live-UI merge point, focusing on the real user-facing surfaces that expose social metrics: Home feed posts, Profile, Profile post cards, Discover people, Discover post results, and the existing bottom navigation. The current architecture already centralizes the public count data in API responses such as `visibleCounts` and `displayCounts`, so the change can stay presentation-only without altering database records or metric calculations.

## Current findings
1. Public social counts are rendered as raw integers in several places:
   - Profile: posts, followers, following, likes, comments, shares, views.
   - Home feed: reactions, comments, shares.
   - Profile post cards: likes, comments, shares.
   - Discover: follower counts and post engagement counts.
2. The same raw count is represented differently across surfaces, which makes large audiences visually noisy.
3. The Home feed still contains a generic “Socialhub moment” gradient placeholder for text-only posts. This is decorative content rather than the user's post content and is inconsistent with the cleaner feed direction.
4. The existing data layer already supports authoritative/admin-adjusted display counts, so formatting must never mutate or round stored values; it should only change presentation.
5. The current live-update work should remain intact: polling, relationship state, pagination, messaging composer, and navigation should not be coupled to the formatting change.

## Implementation plan

### Phase 1 — Shared count presentation
Create a single `compactCount` helper:
- < 1,000: exact integer (for example `842`).
- 1,000–999,999: `K` notation (for example `1.2K`, `12.5K`, `125K`).
- 1,000,000–999,999,999: `M` notation (for example `1.2M`, `12.5M`).
- Billion-scale values use `B` so the formatter remains future-proof.
- Always sanitize invalid/negative presentation values to a non-negative integer.
- Expose the exact full count through a tooltip/accessible label on interactive/stat elements so compact UI never hides the precise value.

### Phase 2 — Apply to social surfaces
Use the shared helper everywhere a social audience/engagement count is visible:
- Profile statistics.
- Feed engagement summary.
- Profile post engagement controls.
- Discover follower and post engagement counts.
Keep request/badge counters as normal small integers because those represent immediately actionable queue sizes rather than audience metrics.

### Phase 3 — Feed visual cleanup
Remove the text-only “Socialhub moment” placeholder and let text-only posts render as normal posts without invented copy. Keep media posts unchanged and preserve live feed behavior.

### Phase 4 — Consistency + accessibility
- Add `title`/accessible full-count context for compact counters.
- Keep count semantics and labels stable for screen readers.
- Avoid changing API contracts, database metrics, live polling, or relationship logic.
- Maintain the current responsive/mobile navigation architecture.

### Phase 5 — Regression gate
Add contract tests that verify:
- The formatter has K/M/B thresholds.
- Social surfaces import/use the formatter.
- Exact counts remain available as accessible/title context.
- The text-only feed no longer injects “Socialhub moment” placeholder copy.
Then run test suite, lint, typecheck, and production build/CI.

## Acceptance criteria
- A post with 1,234 likes displays `1.2K`, not `1234`.
- A profile with 12,500 followers displays `12.5K`.
- A profile with 1,200,000 followers displays `1.2M`.
- Values below 1,000 remain exact integers.
- Compact counts never alter backend or stored metric values.
- Exact counts remain discoverable on stat/interactive elements.
- Text-only posts display the author's actual content without generic placeholder marketing copy.
- Existing live UI, friend suggestions, messaging, and bottom navigation behavior remain unchanged.
- No Vercel deployment is triggered during implementation; merge occurs only after the final validation gate passes.

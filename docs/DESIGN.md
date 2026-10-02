# Socialhub — UI/UX Design System

## Brand
Name: Socialhub
Tagline: Connect. Share. Belong.

### Visual personality
Socialhub should feel energetic, modern, trustworthy, and human — not corporate and not a direct visual replica of another social network.

## Layout
### Desktop
- Sticky top navigation.
- Maximum content width around 1440px.
- Three-column authenticated home:
  - Left: navigation/profile shortcuts
  - Center: feed and composer
  - Right: stories, suggestions, trending/active panels
- Feed column remains visually dominant.

### Tablet
- Collapse the left rail.
- Keep feed centered with a compact utility rail.

### Mobile
- Sticky compact header.
- Shared bottom navigation with five primary actions: Home, Discover, Messages, Notifications, Profile.
- Full-width feed cards.
- The composer and post actions remain accessible without being covered by fixed navigation.
- Avoid fixed elements covering CTAs or text inputs.

## Components
Core reusable components:
- Button
- IconButton
- Avatar
- UserIdentity
- Card
- Input
- Textarea
- Dialog/Sheet
- Dropdown
- Tabs
- Toast
- Skeleton
- EmptyState
- ErrorState
- PostCard
- CommentThread
- StoryRing
- ConversationRow
- NotificationRow

## Design tokens
### Typography
- Display: bold, compact headings.
- Body: highly readable neutral sans-serif.
- Metadata: smaller, muted, high-contrast enough for accessibility.

### Shape
- Cards: 18–24px radius.
- Inputs/buttons: 12–16px radius.
- Avatars: circular.
- Pills: fully rounded.

### Motion
- 120–220ms micro-interactions.
- Subtle lift/fade for cards and menus.
- Like/reaction feedback should feel immediate.
- Respect prefers-reduced-motion.

## Surfaces
Use a warm-neutral background with elevated white/dark surfaces and one signature accent family. Gradients are reserved for branding, stories, and selected emphasis rather than every component.

## Feed experience
A post card contains:
1. Author row
2. Timestamp/privacy metadata
3. Post copy
4. Media, when available
5. Reaction summary
6. Action row
7. Collapsed comment entry point, with the full thread expanded on demand

Actions should preserve stable layout dimensions to prevent content jumping.

## Empty/loading/error states
Every data-driven screen gets a designed state rather than a blank screen:
- Skeletons for initial feed/profile loads.
- Helpful empty illustrations or compact empty cards.
- Inline retry for recoverable errors.
- Toasts for completed mutations.

## Accessibility
- Visible keyboard focus.
- Correct labels for icon-only buttons.
- Dialog focus trapping.
- Semantic landmarks.
- Sufficient text contrast.
- Reduced-motion support.
- Touch targets sized for mobile interaction.

## Responsive acceptance criteria
At minimum, validate:
- 360px mobile
- 390px mobile
- 768px tablet
- 1024px laptop
- 1440px desktop
- Wide desktop without excessive stretching

## Screen map
Public:
- /
- /login
- /signup

App:
- /home
- /discover
- /friends
- /messages
- /notifications
- /profile/[username]
- /settings

Admin:
- /admin
- /admin/users
- /admin/posts
- /admin/reports

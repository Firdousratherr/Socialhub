# Socialhub — Product & Engineering Plan

## Product vision
Socialhub is a modern social network built around a fast, visual home feed and simple ways to connect, share, discover, and communicate. It should feel familiar enough to learn instantly while having its own polished visual identity.

## Design principles
- Mobile-first, fully responsive, touch-friendly interaction targets.
- Premium but approachable visual language: soft surfaces, strong typography, subtle gradients, restrained motion.
- Content remains the visual priority; chrome should stay lightweight.
- Every primary interaction has loading, empty, error, and success states.
- Accessibility, semantic HTML, keyboard support, and reduced-motion support are first-class requirements.
- Avoid cloning Facebook branding or UI exactly; use the familiar social-network interaction model with an original design system.

## Core navigation
Authenticated desktop:
- Home
- Discover
- Friends
- Messages
- Notifications
- Profile
- Settings
- Admin (role-gated)

Authenticated mobile:
- Home
- Discover
- Create
- Notifications
- Profile

## MVP capabilities
1. Authentication and onboarding
   - Sign up, sign in, sign out
   - Profile setup and username
   - Session-protected app shell

2. Profiles
   - Avatar, cover, bio, location/links
   - Posts tab
   - Friends/followers tab
   - Profile editing

3. Feed
   - Create text/image posts
   - Like, comment, share
   - Feed pagination/infinite loading
   - Optimistic interaction feedback
   - Empty and error states

4. Social graph
   - Follow/friend requests
   - Accept/reject/remove
   - Suggested people

5. Notifications
   - Likes, comments, follows, requests, messages
   - Read/unread state

6. Messaging
   - Conversations
   - Message composer
   - Unread indicators
   - Conversation list

7. Discovery
   - Search people and posts
   - Suggested accounts/content

8. Stories
   - Create image story
   - Story viewer
   - Expiration model

9. Moderation/admin
   - User management
   - Post/report moderation
   - Basic platform metrics
   - Role-based access

## Phase plan
### Phase 0 — Foundation
Repository structure, design tokens, linting/formatting, environment contract, error/loading conventions, database schema, seed strategy.

### Phase 1 — Visual shell
Public landing/sign-in surfaces plus authenticated responsive shell, navigation, top bar, profile shell, component library, responsive states.

### Phase 2 — Identity
Auth, onboarding, profile editing, profile pages, session protection.

### Phase 3 — Social feed
Post creation, media model, feed queries, likes, comments, shares, pagination.

### Phase 4 — Connections
Friend/follow graph, requests, suggestions, notifications.

### Phase 5 — Messaging
Conversation model, message composer, unread state, realtime-ready abstraction.

### Phase 6 — Discovery & stories
Search, discovery ranking primitives, stories, viewer experience.

### Phase 7 — Moderation
Reports, admin dashboard, role gates, audit events, account/post controls.

### Phase 8 — Production hardening
Validation, rate limiting, authorization review, accessibility pass, performance pass, tests, build verification, Vercel configuration.

## Technical direction
- Next.js App Router + TypeScript
- React Server Components by default; client components only where interaction requires them
- Tailwind CSS with a small semantic design-token layer
- Prisma ORM
- PostgreSQL
- Auth layer isolated behind a server-side service boundary
- Zod for request/form validation
- Server Actions/Route Handlers chosen per operation rather than forcing one pattern everywhere
- next/image for user/content media
- Centralized authorization helpers and validation
- Realtime provider kept behind an adapter so the core domain is not coupled to one vendor

## Quality gates
Every implementation phase must pass:
1. TypeScript/build validation
2. ESLint/formatting
3. Route and authorization sanity checks
4. Mobile/desktop responsive review
5. Loading/empty/error state review
6. No secrets committed to Git
7. Only then deploy or promote to Vercel

## Repository rule
Keep deployment noise low: group related work into coherent commits and avoid triggering unnecessary Vercel deployments for every tiny change.

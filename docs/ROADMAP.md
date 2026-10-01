# Socialhub Product Roadmap

## Delivery rule
Group related work into cohesive milestones. Run CI before merging. Do not promote to Vercel production until the GitHub quality gate is green. Avoid deployment churn from small changes.

## Phase 0 — Production foundation
Status: Complete

- Better Auth production configuration
- One-time admin bootstrap
- Server-side admin route protection
- ADMIN-only inspection
- Audit logging
- SMTP password-reset infrastructure
- Vercel Blob uploads
- Production environment contract

## Phase 0.5 — Public entry + Google authentication
Status: Complete

- Real public entry instead of preview/demo wording
- Authenticated / redirect to /home
- Better Auth Google OAuth integration
- Google sign-in UI
- OAuth environment documentation

## Milestone A — Core social interactions + safety
Status: In implementation

### Feed and posting
- Real post visibility filtering: PUBLIC / FRIENDS / PRIVATE
- Cursor-style feed pagination using a stable time boundary
- Edit own post
- Delete own post
- Image attachment from the existing authenticated upload service
- Media preview before publishing
- Save/unsave posts
- Share-count endpoint and share UI
- Copy post link
- Author post menu with report action

### Comments
- Open comments from a post
- Create comments and replies
- Optimistic/instant UI refresh
- Comment error and empty states
- Prepare edit/delete comment actions

### Safety
- Block/unblock users
- Hide blocked users from feed/discovery relationships
- Report posts
- Report comments/profile targets
- Privacy-aware profile visibility
- Keep moderation operations audited

### Quality
- Centralized request validation
- Authorization checks on every mutation
- Stable loading/error/empty states
- Mobile-safe dialogs/sheets
- No secrets in source control
- CI gate before merge

## Milestone B — Messaging 2.0

- Unread counts backed by lastReadAt
- Mark conversation read
- Edit/delete messages
- Group conversation management
- Message attachments
- Message reactions
- Reply-to-message
- Search
- Realtime adapter
- Typing/online presence

## Milestone C — Stories 2.0

- Story image/video upload
- 24-hour default expiry
- Story viewer
- StoryView/seen state
- Friends-only audience
- Story deletion
- Viewer list
- Story replies/reactions

## Milestone D — Discovery

- Unified people/post search
- Hashtag/topic search
- Trending topics
- Recent searches
- Privacy-aware ranking
- Better suggestions
- Search filters

## Milestone E — Account and identity

- Password reset UI
- Email verification
- Google account linking
- Active session management
- Sign out other sessions
- Security history
- Notification preferences
- Profile completion/onboarding

## Milestone F — Admin and moderation

- Moderation queue
- Post/comment/user actions
- Report assignment and notes
- Audit search/filter/export
- Platform analytics
- User 360 improvements
- Moderation permission boundaries

## Milestone G — Security and reliability

- API rate limiting
- Upload quotas
- Content/MIME validation
- Security headers
- Origin/CSRF review
- Sensitive-data minimization
- Error monitoring
- Query/index review
- Backup/restore runbook

## Milestone H — UX and performance

- Skeleton loading
- Toast system
- Motion polish
- Reduced-motion support
- 360px–wide-desktop QA
- Image optimization
- Core Web Vitals review
- Accessibility audit
- Final release checklist
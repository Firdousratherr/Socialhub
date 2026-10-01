# Socialhub Product Roadmap

## Delivery rule
Group related work into milestones. Run CI before merging. Do not trigger a Vercel production deployment until the GitHub build, type check, and database schema validation are green.

## Phase 0 — Production foundation
Status: In progress

- Separate Socialhub PostgreSQL database
- Better Auth production secret and base URL
- One-time admin bootstrap
- Server-side admin route protection
- ADMIN-only message/user inspection
- Audit logging for sensitive admin reads and writes
- Vercel Blob upload infrastructure
- SMTP-backed password reset flow
- Remove development-only authentication secret fallback

## Phase 1 — Real account experience
- Verified profile data and profile editing
- Avatar and cover uploads
- Password reset UI
- Session management
- Email verification
- Account deletion confirmation and cleanup
- Responsive onboarding

## Phase 2 — Real social feed
- Text + image posts
- Edit/delete own posts
- Comments and threaded replies
- Likes and saves
- Share flow
- Feed pagination/infinite loading
- Empty, loading, and error states
- Media previews and upload progress

## Phase 3 — Social graph + discovery
- Follow/unfollow
- Friend requests
- Block/unblock
- People suggestions
- User/post search
- Topics and hashtags
- Privacy-aware results

## Phase 4 — Messaging
- Direct conversations
- Group conversations
- Unread counts
- Message edit/delete
- Attachments
- Realtime-ready transport
- Mobile conversation UI

## Phase 5 — Stories
- Image/video stories
- 24-hour expiry
- Audience controls
- Story viewer
- Seen state
- Creator management

## Phase 6 — Moderation + admin
- Dashboard
- User management
- User 360 / inspection
- Content moderation
- Reports
- Post/comment actions
- Admin audit search/export
- Moderator permission boundaries

## Phase 7 — Security and reliability
- Rate limiting
- Upload quotas and abuse controls
- CSRF/origin review
- Security headers
- Sensitive-data minimization
- Database indexes and query review
- Error monitoring
- Backup/restore procedure

## Phase 8 — UX and performance
- Motion polish
- Skeleton loading
- Accessible keyboard flows
- Reduced-motion handling
- 360px through wide desktop QA
- Image optimization
- Core Web Vitals review
- Final deployment gate

## Current milestone
The first implementation milestone wires the infrastructure the project already has configured: authentication hardening, admin bootstrap, administrator-only inspection, password-reset email delivery, and Vercel Blob uploads.

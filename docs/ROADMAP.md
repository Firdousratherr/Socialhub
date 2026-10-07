# Socialhub Product Roadmap

## Delivery rules
- Group related work into cohesive milestones.
- Run validation/CI before merging.
- Do not promote to Vercel production until the quality gate is green.
- Avoid deployment churn from small changes.
- Every user-facing feature needs loading, empty, error, mobile, and accessibility states.
- Every mutation needs server-side authentication, authorization, validation, and abuse protection where appropriate.

## Phase 0 — Production foundation
Status: Complete
- Better Auth + PostgreSQL/Prisma
- One-time admin bootstrap and protected admin APIs
- Audit logging and role boundaries
- SMTP transactional email infrastructure
- Vercel Blob uploads
- Production database migration contract
- Public landing page and authenticated routing

## Phase 0.5 — Google authentication
Status: Complete / configuration dependent
- Google OAuth integration
- Production OAuth callback support
- Google sign-in UI
- OAuth environment documentation
- Exact Google Cloud redirect/origin configuration

## Milestone A — Core social interactions + safety
Status: Complete
- Public/friends/private post visibility
- Stable feed pagination
- Post edit/delete
- Image attachments and previews
- Save/unsave
- Share counts and copy-link flow
- Threaded comments/replies
- Report post/comment/profile
- Block/unblock
- Privacy-aware profile visibility
- Moderation audit logging

## Milestone A.5 — Navigation, page shell & real-data integrity
Status: Complete for this pass

- Consistent back navigation with same-origin history fallback
- Working mobile hamburger menu across app pages
- Logout action inside mobile navigation
- Working global people search from desktop/mobile header into Discover
- Working conversation search within Messages
- Remove demo conversation data from real message inboxes
- Remove demo notification data from real notification views
- Empty states for real feeds and inboxes instead of fabricated content
- Stable `/profile/me` route for the signed-in user
- Branded 404 page and unknown-route handling
- Mobile/desktop navigation QA targets for 360px through wide desktop

## Milestone B — Authentication, recovery & identity
Status: In implementation
### Email security
- 6-digit email OTP verification on signup
- OTP expiry, attempt limits, and resend cooldown
- OTP-based forgot-password recovery
- Strong password requirements
- Revoke other sessions after password reset
- Clear success/error/expired-code states
- Google OAuth remains a separate verified sign-in path

### Account security
- Email verification state in account UI
- Change email with verification
- Change password
- Active session/device management
- Sign out other sessions
- Security activity/history
- Optional 2FA with TOTP/backup codes
- Rate limiting and abuse controls for auth endpoints

## Milestone C — Profile 2.0
Status: In implementation
- Display name and username editing
- Bio, location, website
- Avatar and cover uploads
- Private-account control
- Profile share/copy link
- Joined-date metadata
- Posts / Photos / Friends tabs
- Privacy-aware friend/profile views
- Profile completion indicator
- Featured/pinned post
- Profile photo crop/preview
- Better public profile SEO/share metadata
- Friend/follow relationship controls
- Block/report controls
- Saved-post access for the owner

## Milestone D — Feed 2.0
- Reactions beyond Like
- Comment edit/delete
- Rich media galleries
- Video support
- Link previews
- Mentions and hashtag parsing
- Post drafts
- Pinned posts
- Feed filters
- Saved-post page
- Better optimistic updates
- Skeletons and retry states

## Milestone E — Messaging 2.0
- Unread counts backed by lastReadAt
- Mark conversation read
- Edit/delete messages
- Group conversations
- Message attachments
- Message reactions
- Reply-to-message
- Message search
- Realtime transport
- Typing indicators
- Online/last-seen presence
- Conversation mute/archive


## Milestone E.5 — Device & App Control Center
Status: Foundation implemented

### Managed-device foundation
- Device enrollment and ownership state
- Device registry and lifecycle state
- Installed-application inventory model
- Policy assignments and version-aware app rules
- Device command queue with explicit execution status
- Inventory snapshots
- Device-management audit trail
- Dedicated `DEVICE_MANAGEMENT` admin permission

### Control Center
- Device 360 overview
- Application inventory with package/version/policy state
- Allowed / blocked / required application policies
- Minimum-version compliance
- Device compliance and synchronization state
- Explicit, auditable administrative commands
- User-facing management transparency
- No covert access to personal app contents, camera, microphone, calls, files, or credentials

### Android management boundary
- Ordinary Socialhub installs remain limited to Android APIs and package visibility permitted to normal apps.
- Device Owner / Profile Owner capabilities are used only for explicitly enrolled managed devices.
- Broad package visibility is not added solely to enumerate unrelated applications.
- Every management mutation requires server-side authorization, validation, audit logging, and a device acknowledgement.


## Milestone F — Stories 2.0
- Image/video upload
- 24-hour expiry
- Story viewer
- StoryView/seen state
- Friends-only audience
- Story deletion
- Viewer list
- Story replies/reactions
- Story privacy controls

## Milestone G — Discovery
- Unified people/post search
- Hashtag/topic search
- Trending topics
- Recent searches
- Privacy-aware search
- Suggestions based on mutual connections
- Search filters
- Follow/friend recommendations

## Milestone H — Notifications
- Unread badge counts
- Notification preferences
- Grouped notifications
- Deep links to the triggering post/profile/message
- Email notification preferences
- Push notification foundation
- Mark individual notifications read

## Milestone I.5 — Code audit, integrity & operations
Status: In implementation

### Real-data integrity
- Remove fabricated people, trend counts, social-proof numbers, and dead actions from authenticated surfaces
- Keep empty, loading, and error states tied to real API responses
- Return actual follow/friend state from discovery APIs
- Keep user-visible engagement counts derived from real database aggregates

### Messaging integrity
- Persist unread state from `ConversationMember.lastReadAt`
- Mark conversations read when opened
- Show unread counts in the inbox
- Prevent duplicate direct conversations
- Respect reciprocal blocks when starting a conversation

### Security hardening
- Validate uploaded image signatures in addition to declared MIME type
- Add baseline security response headers
- Add endpoint-specific Better Auth rate limits for sign-in, signup, verification, and password recovery
- Continue hardening direct application APIs with validation, request limits, and abuse controls

### Admin operations
- Dashboard for live platform aggregates
- Moderation queue for reports and status transitions
- User management with explicit role boundaries
- User 360 for privileged, audited inspection
- Content moderation with audited hide/delete actions
- Read-only analytics based on live counts
- Audit-log visibility for sensitive admin operations
- Keep privileged message inspection restricted to administrator-level access

### Quality gate
- Typecheck
- Prisma validation/generation
- Production build
- Responsive smoke-test targets
- Auth, feed, messaging, moderation, and admin regression checks

## Milestone I — Admin & moderation
- Moderation queue
- User/post/comment actions
- Report assignment and notes
- Audit search/filter/export
- Platform analytics
- User 360
- Moderation permission boundaries
- Account suspension workflow
- Content removal workflow
- Case notes and moderator assignment
- Evidence snapshots and moderation history
- Bulk actions with confirmation and audit records

## Milestone J — Security & reliability
- API rate limiting
- Upload quotas
- MIME/content validation
- Security headers
- Origin/CSRF review
- Sensitive-data minimization
- Error monitoring
- Query/index review
- Backup/restore runbook
- Abuse/spam detection
- Disposable-email controls

## Milestone K — UX & performance
- Skeleton loading
- Toast system
- Motion polish
- Reduced-motion support
- 360px → wide-desktop QA
- Image optimization
- Core Web Vitals review
- Accessibility audit
- Keyboard navigation audit
- Error/empty-state consistency
- Final release checklist

## Release gates
1. Feature implemented on a dedicated branch.
2. Typecheck and database validation pass.
3. Production build passes.
4. PR checks are green.
5. Merge to `main`.
6. Verify the resulting Vercel production deployment.
7. Smoke-test critical flows:
   - signup + email OTP
   - login
   - forgot password + OTP
   - Google OAuth
   - profile edit/upload/privacy
   - feed/post/comment
   - messaging
   - admin protection

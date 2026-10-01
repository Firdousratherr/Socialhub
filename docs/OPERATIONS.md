# Socialhub Operations Runbook

## Production release
1. Confirm GitHub CI is green for the release branch.
2. Merge through the protected GitHub workflow.
3. Vercel builds from the repository production branch automatically.
4. Verify `/`, authentication, feed, messaging, stories, notifications, and `/admin/login` after deployment.

## Database changes
Production builds run Prisma migrations before the Next.js build. Never edit an applied migration. Add a new timestamped migration for every schema change.

Before merging a schema change:
- run Prisma validation and type checking in CI;
- review destructive changes and indexes;
- confirm the migration is safe to run on the current production schema.

## Rollback
Application regressions should be rolled back to the previous successful Vercel deployment. Database rollback should be performed with an explicit forward migration rather than assuming an application rollback can undo schema changes.

## Secrets
Keep Better Auth, admin, Blob, SMTP, and OAuth credentials in Vercel Environment Variables. Do not commit secrets or put them in client-side configuration.

## Admin security
Administrator login uses PostgreSQL-backed rate-limit state so limits apply across serverless instances. Rotate the configured admin credentials through Vercel Environment Variables when required.

## Media lifecycle
Managed Vercel Blob objects are cleaned up when profile images, post media, story media, or message attachments are replaced or deleted. External media URLs are never deleted by Socialhub.

## Incident checklist
Record the UTC timestamp, deployment SHA, route, error message, recent migration, and whether the failure reproduces for authenticated or signed-out users. Fix forward when a migration has already been applied.
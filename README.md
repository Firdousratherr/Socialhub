# Socialhub

Socialhub is a modern social-media platform focused on a fast visual feed, profiles, connections, messaging, discovery, stories, and a role-gated moderation area.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma + PostgreSQL
- Better Auth
- Vercel Blob
- Lucide React

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Validation

The main CI pipeline validates:

1. Prisma schema
2. TypeScript
3. Repository integrity and critical route/schema presence
4. Security/blueprint contract tests
5. ESLint
6. Production build

Run the same core checks locally with:

```bash
npm run db:validate
npm run typecheck
node scripts/repository-smoke.mjs
npm test
npm run build:ci
```

## Database migrations

Production application builds intentionally do not run Prisma migrations. Use the explicit migration command during a controlled release:

```bash
npm run db:migrate
```

This keeps deployment builds deterministic and prevents a non-empty production database from blocking the Next.js build.

## Project documents

- `docs/PLAN.md` — product and engineering roadmap
- `docs/DESIGN.md` — UI/UX and responsive design system
- `docs/BRANCH-RECONCILIATION.md` — final historical branch audit and repository operating policy

## Repository status

`main` is the authoritative development line. Historical feature branches are not alternative production versions; new work should flow through short-lived feature branches and pull requests into `main`.

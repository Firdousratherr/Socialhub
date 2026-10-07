# Socialhub v1.0.6 — Android UX + Website Download Blueprint

## Goals
- Fix Android post/story publish controls showing a spinner before submission.
- Stop Discover from crashing when search results render.
- Rebuild Android navigation/header/menu and messaging UI.
- Add a first-class /download APK page.
- Add audited admin setting app.download.url.
- Add a persistent APK download CTA/footer across the website.
- Use direct GitHub release asset URLs, never the GitHub release landing page.

## Android
1. Separate loading from disabled button state.
2. Discover: skip empty searches and normalize missing interaction arrays.
3. Redesign header/menu with safer spacing and clearer branding.
4. Redesign Messages list and chat composer while preserving realtime, typing, replies, edits, deletes, attachments and keyboard handling.
5. Bump release identity to 1.0.6 / Android versionCode 7.

## Website
1. Add /download page with current APK information and direct download button.
2. Add admin Platform setting app.download.url.
3. Use current v1.0.5 direct APK URL as fallback.
4. Add a shared bottom download banner/footer to website pages.

## Validation
- TypeScript, Expo Doctor, Expo Android prebuild/debug build, and web CI.
- No Vercel deployment or public APK release during this implementation pass.
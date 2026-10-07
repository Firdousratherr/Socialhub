# SocialHub Native Android Implementation Blueprint

## Objective
Build a real native Android client for Socialhub using React Native + Expo SDK 57, sharing the existing Next.js/Better Auth/PostgreSQL backend. The mobile app is a native client, not a WebView wrapper.

## Architecture
- UI/runtime: React Native + Expo SDK 57, portrait-first Android experience.
- Authentication: Better Auth 1.7.7 with @better-auth/expo, SecureStore session/cookie storage, email/password, email OTP, Google OAuth deep-link callback.
- API: existing Socialhub REST endpoints under /api; authenticated REST calls reuse the Better Auth session cookie.
- Media: Expo ImagePicker for device media selection; existing /api/uploads endpoint for server-side validation and Vercel Blob storage.
- Navigation: lightweight native screen state for the first release, with a single bottom navigation shell and modal/detail states. This keeps dependencies small and reduces navigation-related build risk.
- CI: GitHub Actions validates Expo dependencies, TypeScript, native prebuild, and a real Gradle debug APK build. The workflow must run on the Android feature branch before merge.

## Product scope

### Phase 0 — Foundation and build safety
1. Keep the mobile project isolated under mobile/.
2. Keep root Next.js TypeScript/ESLint scopes excluding mobile.
3. Add Better Auth Expo server plugin and production deep-link trusted origins.
4. Add a self-validating Android APK workflow.
5. Add this blueprint and a runbook so future changes are repeatable.

### Phase 1 — Release-quality core
1. Auth gate with password sign-in, email OTP sign-in, registration, verification OTP, forgot-password OTP reset, Google OAuth, persistent session and sign-out.
2. Home feed with refresh, post cards, image media, like/unlike, save/unsave, and text/image posting.
3. Stories with a horizontal story tray, viewed/unviewed state, viewer navigation, image stories, and story uploads.
4. Discover with user/post search, follow/friend state, and friend-request actions.
5. Messaging with conversation list, conversation detail, send/read messages, and unread counts.
6. Notifications with list and unread badge.
7. Profile with summary, editable name/username/bio, own posts, and sign-out.

### Phase 2 — Native media and engagement
1. Video story/post playback with expo-video.
2. Multi-media composer and upload progress.
3. Comments, reactions, and replies.
4. Saved posts.
5. Friends/request management.
6. Profile image and cover uploads.
7. Better offline/error/retry states.

### Phase 3 — Mobile platform features
1. Native push notifications and preferences.
2. Deep links for posts, profiles, messages, and stories.
3. Background refresh where appropriate.
4. Secure device/session management.
5. Accessibility, Android back handling, keyboard-safe layouts, and responsive polish.

### Phase 4 — Release and store readiness
1. Release APK smoke test.
2. Signed production AAB.
3. Version-code automation.
4. Play Store metadata/checklist.
5. Release regression checklist.

## First implementation target
Complete Phase 0 and the usable Phase 1 core in the feature branch, validate the Android APK in GitHub Actions, then merge the validated branch into main. No Vercel deployment is part of this work.

## Acceptance criteria
- Android workflow is visible from the default branch after merge.
- expo-doctor passes.
- Expo prebuild succeeds.
- Gradle debug APK builds successfully.
- No TypeScript errors in mobile source.
- Authentication is guarded; signed-out users cannot enter app screens.
- Core tabs are functional rather than placeholders.
- No website/Vercel deployment is triggered by the Android workflow.


## Android 1.1.0 implementation status
- Runtime camera and microphone permissions are enabled and requested only from capture/call actions.
- Android system document picker is available for message attachments.
- Upload API validates common document MIME types and file signatures, with a 10 MB per-document limit.
- Message attachments preserve image/video/document type.
- Notification permission settings and device push-token registration endpoint are present.
- Voice/video calling backend uses short-lived LiveKit tokens; secrets remain server-side.
- Android LiveKit native config is included; screen-sharing service remains disabled.
- No contacts, location, SMS, call-log, broad filesystem, hidden capture, or covert monitoring permissions are added.

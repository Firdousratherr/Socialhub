# Socialhub Android 2.0 — Website-Parity + Premium UI Blueprint

## Objective

Redesign the native Android client around the selected premium dark/purple Socialhub direction while preserving the existing backend contracts and bringing the mobile experience into functional parity with the website.

Baseline:
- Android branch: `feature/android-ui-fixes`
- Base commit: `6f7ea388767c184dcbd3896865d49e64a55ec5e1`
- Web platform: Next.js + Better Auth + Prisma + Vercel
- Mobile platform: React Native + Expo SDK 57
- Primary API: existing `/api/*` contracts

No production deployment is part of this implementation.

---

## 1. Product Principles

### Visual direction
Use the selected premium social UI direction as inspiration, not as a pixel copy:
- deep charcoal/black canvas
- indigo/purple signature accent
- elevated cards with restrained glass/blur treatment
- large media and content-first feed
- rounded 18–24px surfaces
- 44px+ touch targets
- 120–220ms micro-interactions
- clear hierarchy, minimal visual noise

### Interaction principles
- Android system status-bar safe area on every top-level screen
- keyboard-safe composer/input behavior
- no fixed control may cover an input, CTA, story action, or bottom navigation
- loading indicators only appear while work is actually in progress
- every data screen has loading, empty, and recoverable-error states
- optimistic reactions where safe; errors roll state back
- Android back navigates detail → parent before leaving the app
- no hidden or covert device capture/control

---

## 2. Website → Android Feature Parity Matrix

| Website capability | Android baseline | Android 2.0 target |
|---|---|---|
| Auth/password | Present | Premium auth UI + launch transition |
| Email OTP signup/verification | Present | Retain + polish |
| Forgot password OTP | Present | Retain + polish |
| Google auth/deep link | Present | Retain + polish |
| Home feed | Present | Add feed mode switch + stronger states |
| For You ranking | Present | Retain |
| Following/Friends/Latest/Saved feed modes | Partial | Add feed selector |
| Stories | Present | Premium tray/viewer + safer publishing |
| Story reactions/replies/views | Present | Retain + polish |
| Post composer | Present | Premium composer + stable publish state |
| Post media | Present | Image/video preview and validation |
| Likes/reactions | Present | Retain |
| Comments/replies | Present | Keep keyboard-safe comment sheet |
| Save posts | Present | Retain |
| Share posts | Present | Retain |
| Report/block post | Partial | Surface in post actions |
| Discover search | Present | Add suggestions, trends, people/posts/hashtags |
| Discover relationship controls | Present | Retain and harden API fallbacks |
| Visitor profile | Missing | Add username-driven profile screen |
| Follow/friend lifecycle | Partial | Full state machine: add/accept/decline/cancel/unfriend/follow |
| Profile privacy | Partial | Respect server-provided capability states |
| Profile friends/relationships | Missing | Add relationship sheets and privacy-aware states |
| Profile share/report/block/mute | Partial | Add to visitor profile actions |
| Messages | Present | Premium list + drafts + group controls |
| Message search | Partial | Conversation search retained; add active-chat search entry |
| Typing | Present | Retain |
| Read receipts | Partial | Surface Seen state |
| Message reactions | Data exists | Add quick reaction UI |
| Reply/edit/delete | Present | Retain |
| Attachments | Image present | Retain and polish |
| Archive/mute | Partial | Add unmute and clearer state |
| Groups | Data/backend present | Add group info/member controls |
| Calls | Present | Premium calling entry + history |
| Notifications | Present | Filtered, grouped visual treatment |
| Friends | Present | Premium tabs/cards + status correctness |
| Saved | Present | Improved card/library UI |
| Settings | Present | Mirror website controls |
| Security/sessions | Present | Retain explicit privacy controls |
| Push/deep links | Present | Correct profile/post/story/message routing |
| Admin | Present | Owner-only entry from menu/settings |
| Creator/monetization foundation | Backend/flag foundation | Do not expose unsupported payment flows |
| Privacy/safety | Present | Preserve consent-based permission model |

---

## 3. Android Information Architecture

### Primary bottom navigation
- Home
- Friends
- Messages
- Notifications
- Profile

### Secondary right-side menu
- Discover
- Calls
- Saved posts
- Settings
- Security
- Admin (owner-only)
- Sign out

### Deep links
- post → Home + highlight/bring post to top
- story → Home + open story viewer
- message/conversation → Messages + open conversation
- profile/user → Profile + load visitor username

---

## 4. Screen Blueprint

### Launch
A branded native/custom launch layer after the OS splash:
1. Socialhub brand mark appears.
2. Soft indigo glow expands/fades.
3. Brand mark settles with a subtle scale.
4. Wordmark “Socialhub”.
5. “Connect. Share. Belong.”
6. Transition to auth or authenticated app.
- duration target: ~900–1100ms
- never block longer than necessary after session bootstrap
- use reduced-motion-safe behavior

### Authentication
- large brand mark
- high-contrast title/subtitle
- modern rounded fields
- purple primary CTA
- OTP/forgot flows retain current backend behavior
- no layout jump when loading/error text appears

### Home
Header:
- brand mark left
- title / feed mode
- refresh
- hamburger right

Content:
- feed mode pill: For You, Following, Friends, Latest, Saved
- stories rail
- composer
- post cards
- empty/error/skeleton states

### Discover
Hero:
- “Discover”
- search field with icon
- optional filter chips

Sections:
- Suggested people when no query
- Trending hashtags
- People results
- Post results
- Hashtag results

Safety:
- blocked/muted filtering remains server-authoritative
- compact K/M/B counts

### Messages
Inbox:
- search
- Active/Archived toggle
- conversation cards with avatar, preview, timestamp, unread badge

Conversation:
- large safe header
- avatar + display name + presence
- audio/video call actions
- message list
- typing indicator
- reply/edit context
- attachment button
- multi-line input
- send button
- Seen/edit labels
- reaction sheet
- group info controls

### Profile
Own and visitor profiles share one visual system:
- cover
- avatar
- name / username / verified state
- bio
- posts/followers/following/engagement stats
- primary action row
- tabs for posts/photos/friends where allowed
- relationship sheets
- share / report / mute / block actions

### Friends
- segmented tabs
- request cards
- sent requests
- suggestions
- all friends

### Notifications
- filter chips
- unread emphasis
- actor avatars
- deep-link actions

### Calls
- recent call history
- clear incoming/outgoing status
- audio/video icons
- call detail/active call overlay

### Settings/Security/Admin
Use the same card hierarchy and icon language as the rest of the app. Preserve the existing backend permission boundaries.

---

## 5. Visual System

### Palette
- Background: #07070B
- Elevated surface: #101017
- Raised surface: #171721
- Border: #292936
- Primary text: #F8F8FF
- Secondary text: #9898A8
- Accent: #765CFF
- Accent bright: #9A89FF
- Accent soft: #292155
- Success: #69D79B
- Danger: #FF7777

### Typography
- Large screen title: 24–28px / 900
- Card title: 15–17px / 800–900
- Body: 14–16px / 500
- Metadata: 10–12px
- Buttons: 12–14px / 800–900

### Shapes
- Main cards: 18–22px radius
- Buttons: 13–16px radius
- Circular avatars/story rings
- Floating bottom nav: 24px radius

### Motion
- press feedback: 120–160ms
- sheet/menu: 180–220ms
- launch sequence: ~1s
- respect reduced motion where practical

---

## 6. Branding + Launch

### Brand asset strategy
Use a dedicated reusable `BrandMark` component for the in-app logo so the mark is crisp at all resolutions and consistent across:
- launch screen
- auth screen
- app header
- drawer
- empty states

Retain the existing PNG asset for Expo icon/adaptive icon compatibility.

### Android icon/splash
- versioned app branding
- dark launch background
- centered mark
- adaptive icon continues using `mobile/assets/icon.png`
- custom in-app launch layer provides the animated experience after the native splash

---

## 7. Reliability Fixes

1. Normalize optional API arrays with `?? []`.
2. Never render a loading spinner solely from component mount.
3. Preserve button dimensions while publishing/uploading.
4. Add debounce/cancellation-safe search.
5. Guard empty/partial API payloads.
6. Keep FlatList padding above fixed bottom navigation.
7. Keep chat composer inside KeyboardAvoidingView.
8. Use safe-area insets for every fixed top/bottom region.
9. Preserve scroll position on incremental message/feed updates.
10. Never silently swallow a screen-level error without an inline state.

---

## 8. Safety + Permissions

The mobile client only uses camera, microphone, media, notifications, and other permissions when required by explicit user actions or visible app features.

Do not implement:
- hidden photo capture
- hidden microphone recording
- hidden screen capture
- hidden file extraction
- silent call interception
- covert activity monitoring

Security/admin tools remain consent-based and auditable.

---

## 9. Implementation Phases

### Phase A — Design foundation
- Theme tokens
- icon language
- BrandMark
- LaunchScreen
- header/drawer/nav redesign
- global safe-area rules

### Phase B — Core experience
- Home/feed
- Discover
- Messages/inbox
- Chat
- Notifications
- Friends
- Profile

### Phase C — Secondary functionality
- Saved
- Calls
- Settings
- Security
- Admin

### Phase D — Parity hardening
- visitor profile deep links
- discover suggestions/trends/hashtags
- message group controls
- message reactions / Seen state
- feed mode selector
- draft persistence

### Phase E — QA gates
- TypeScript
- Expo doctor
- native prebuild
- Android Gradle debug build
- smoke navigation
- auth/OTP
- feed/stories
- Discover
- profile relationships
- messaging/calls
- settings/security/admin
- Android back behavior
- status-bar and keyboard visual review

---

## 10. Definition of Done

The Android feature branch is ready for PR when:
- website feature parity gaps are either implemented or deliberately deferred with a documented reason
- UI is consistently premium dark/purple
- logo and launch animation are visible
- header is status-bar safe
- hamburger remains on the right
- bottom navigation never covers content
- chat input stays above the keyboard
- Discover does not crash on empty/partial responses
- visitor profile deep links work
- existing APIs are reused instead of duplicated
- no production deployment occurs before CI/build verification

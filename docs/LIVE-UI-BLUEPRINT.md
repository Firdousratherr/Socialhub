# Socialhub Live UI Enhancement Blueprint

## Goal
Make the Socialhub interface feel continuously current without introducing a paid realtime vendor or changing the existing data model.

## Implemented
- Foreground-aware polling pauses while the tab is hidden or offline and resumes on visibility/online recovery.
- Same-browser live sync uses CustomEvent + BroadcastChannel for immediate cross-view and cross-tab state propagation.
- Unread badges are backed by one shared polling loop instead of one timer per mounted badge.
- Home feed refreshes live data every 7 seconds, updates existing post metrics in place, and surfaces unseen posts with a non-jumping “new posts” affordance when the user is reading lower in the feed.
- Open comment threads refresh every 5 seconds while preserving older paginated comments.
- Messaging keeps its 2-second active-chat refresh, pauses it while hidden/offline, adds a non-jumping “new messages” affordance, immediately scrolls after a sent message, and switches cleanly between inbox and active chat on mobile.
- Notification screen refreshes every 6.5 seconds, preserves older pagination, and synchronizes read state with the shared unread layer.
- Feed/message/comment mutations emit local sync events so multiple Socialhub tabs do not remain stale.
- Shared UI primitives now include consistent inputs/buttons, stronger focus behavior, chat overscroll containment, stable scrollbars, safe-area support, and improved text rendering.

## Live-update model
This implementation is intentionally vendor-neutral: there is no external WebSocket/Pusher/Ably dependency. Cross-user freshness is achieved through short foreground polling, while local tabs/windows synchronize immediately through browser events and BroadcastChannel.

## UX guardrails
New content does not force the user back to the top while they are reading. Chat refreshes preserve scroll when the reader is away from the latest message and present a jump affordance instead. Hidden/background tabs do not continuously poll.

## Validation
The branch adds contract coverage for the live polling utility, shared unread state, notification refresh, feed live activity, comment refresh, and mobile messaging behavior.

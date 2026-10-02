# Socialhub Profile Page Blueprint

## Goal
Make other-user profiles immediately actionable on desktop and mobile, with relationship state and privacy behavior visible below the profile counts instead of hiding primary actions in the page header.

## Phase 1 — Profile header and action placement
- Keep the page title/header minimal; reserve it for navigation and the mobile menu.
- Move primary profile actions into a dedicated action bar directly below posts/followers/following counts.
- Use labeled buttons with touch-friendly targets rather than icon-only controls.
- Keep actions wrapping naturally on mobile and desktop.

### Visitor action states
- Not a friend: Add friend is visible.
- Incoming friend request: Accept friend and Decline are visible.
- Outgoing friend request: Request sent and Cancel request are visible.
- Already friends: show the relationship and provide Unfriend.
- Public non-friend accounts: Follow remains available.
- Private non-friend accounts: do not present Follow as an available action; use Add friend as the relationship path.
- Messaging follows the target account's message privacy setting and shows Messages off when new conversations are restricted.
- Report and Block stay visible as explicit safety actions.
- Share remains available for every profile.

## Phase 2 — Relationship correctness
- Profile API exposes only the relationship action state needed by the client: friendRequestStatus, friendRequestId, and canMessage.
- Friend requests reuse the existing friend-request API and preserve server-side privacy/block checks.
- Accepting a request creates the reciprocal follow relationships already used by the friendship model.
- Unfriending removes the friendship and both reciprocal follows.
- Cancelling an outgoing request is supported from the profile.

## Phase 3 — Friends and relationship privacy
- Friends tab must respect showFriendsList; the client must consume the API's hidden state.
- Followers/following/mutual relationship dialogs must distinguish an intentionally hidden list from an empty list.
- Mutual connections must represent accepted friendships, not merely overlapping follows.
- Blocked profiles remain unavailable.

## Phase 4 — Messaging and private accounts
- Profile UI reflects allowMessagesEveryone.
- Conversation creation remains the authoritative enforcement point.
- Private-account profile posts remain restricted to the owner and accepted friends.
- Public posts remain readable according to their per-post visibility.

## Phase 5 — Verification
- TypeScript typecheck.
- Prisma schema validation.
- Production build.
- GitHub Actions CI must finish successfully.
- Only the verified, passing implementation should remain on main.

## Acceptance criteria
- Primary profile controls are visible below the counts without needing the page-header action area.
- A visitor can see and use the correct Add friend / request / accept / cancel / unfriend state.
- Friends-tab privacy is reflected correctly in the UI.
- Relationship dialogs explain hidden lists clearly.
- Mutual friends are actual accepted friends of both accounts.
- Message restrictions are visible before the user attempts to create a conversation.
- CI passes after the complete profile work.

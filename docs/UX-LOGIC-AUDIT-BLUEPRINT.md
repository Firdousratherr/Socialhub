# Socialhub UX + Logic Audit Blueprint

## Audit findings
- The real message composer existed in source but was pushed below the mobile viewport by a viewport-sized minimum-height layout.
- Message polling could reset the new-message indicator and the older-message cursor.
- A multiple-file attachment input only processed the first selected file.
- Friend suggestions came from a broad user list, allowing friends, follows, and pending requests to reappear.
- Discover could leave a private-account friend-request action visually stale after success.
- Home duplicated Messages in the header even though mobile bottom navigation already contains it, and a non-actionable promotional moment block added noise.
- Message/friend surfaces were using initials even when profile images were available.

## Implemented fixes
1. Bounded the mobile Messages shell to the actual available viewport and kept the composer as a non-shrinking bottom region.
2. Preserved unseen-message indicators and older-message pagination across live polling, with throttled read-state updates when the user is at the bottom.
3. Added multi-image attachment upload support up to four files.
4. Made friend suggestions relationship-aware server-side and filtered again client-side.
5. Updated private friend-request state immediately after success.
6. Removed the duplicate home-header Messages action and the non-functional promo while keeping real Stories.
7. Added profile images and account-badge metadata to messaging/relationship surfaces.
8. Added contract coverage for the regressions.

## Acceptance criteria
- Mobile active chat always exposes typing, attachment, and send controls.
- Selecting multiple message images uploads all selected files up to the cap.
- Live polling never hides the new-message indicator or older pagination state.
- Suggestions never contain existing friends, follows, blocks, or pending requests.
- The private-account request action changes state immediately.
- Home has one persistent mobile Messages destination.
- Real Stories remain available independently of the removed promotional block.
- Changes stay on the feature branch until all checks are successful.

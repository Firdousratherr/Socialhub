# Socialhub Mobile Navigation + Settings Blueprint

## Mobile navigation
- Use one reusable drawer across the feed and secondary mobile pages.
- Provide a large touch target, backdrop close, X close, Escape close, route-change close, and body-scroll locking.
- Keep the drawer above sticky headers and mobile bottom navigation.
- Highlight the current route and provide Profile, Settings, Privacy, and Security quick links.

## Settings
### General
- Inline editor for display name, username, bio, location, and website.
- Secure email-change flow: verify current email, then verify the new email.
- Secure password-change flow with optional sign-out of other sessions.

### Privacy
- Private account and relationship/message visibility controls remain directly editable.

### Notifications
- Individual activity notification preferences remain directly editable.

### Security
- Verification status/request.
- Active session list.
- Per-session revoke and sign-out-other-devices.
- Current-device sign-out.
- Owner protection and account-deletion safeguards remain server-side.

### Help
- Plain-language guidance for where each setting lives.

## UX rules
- No decorative setting rows that pretend to be clickable.
- Disabled controls must look disabled and explain why when appropriate.
- Save/error feedback should appear immediately without page navigation.
- Mobile controls use touch-friendly targets and avoid horizontal overflow.

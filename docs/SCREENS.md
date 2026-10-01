# Socialhub Core Screens

The first route-level UI pass now covers:

- Authentication: /login and /signup
- Profile: /profile/[username]
- Messages: /messages
- Discovery: /discover
- Friends: /friends
- Notifications: /notifications
- Settings: /settings
- Admin: /admin, /admin/users, /admin/posts, /admin/reports

The screens share the existing Socialhub visual language and responsive card/navigation patterns. They are UI shells for now; persistence, real authentication, database queries, media uploads, realtime messaging, and moderation APIs are planned for the backend phase.

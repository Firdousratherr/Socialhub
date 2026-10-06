# SocialHub Android

Native React Native / Expo Android client for the existing SocialHub backend.

## Development

From this directory:

```bash
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_BASE_URL` to the deployed SocialHub API when needed.

## APK

The `preview` EAS profile is configured to produce an installable Android APK:

```bash
eas build --platform android --profile preview
```

The `production` profile produces an Android App Bundle for store distribution.

This project does not deploy the Next.js website.

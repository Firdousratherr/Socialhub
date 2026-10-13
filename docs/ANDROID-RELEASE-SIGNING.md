# Android release signing

The Android release workflow must use the same private signing key for every production update. It no longer generates a fresh key during each run.

## Required GitHub Actions secrets

In **GitHub → Socialhub repository → Settings → Secrets and variables → Actions**, add:

- `ANDROID_KEYSTORE_BASE64`: the base64-encoded contents of the release JKS keystore.
- `ANDROID_KEYSTORE_PASSWORD`: the keystore password.
- `ANDROID_KEY_ALIAS`: the alias stored in the keystore.
- `ANDROID_KEY_PASSWORD`: the private-key password.

Create a key only once, store it securely outside the repository, and never commit the keystore or passwords. Example commands for a **new** key:

```bash
keytool -genkeypair -v \
  -storetype JKS \
  -keystore socialhub-release.keystore \
  -alias socialhub \
  -keyalg RSA -keysize 4096 -validity 10000

# Linux:
base64 -w 0 socialhub-release.keystore
# macOS:
base64 < socialhub-release.keystore | tr -d '\n'
```

Use the password and alias chosen during key creation. If using a JKS keystore, configure the private-key password when prompted and store both passwords safely. The base64 output goes into the GitHub secret; do not paste it into a commit or issue.

## Important: existing-install compatibility

Previous workflow runs generated a random keystore on the runner and did not retain it as an artifact. A new persistent key cannot sign as that old key. Before publishing an update, check whether the original signing keystore was saved elsewhere and use it if available. If it cannot be recovered, an APK signed with a new key will not install as an in-place update over the old APK; users may need to uninstall the old app first, which can remove local app data.

## Release rules

- Push a version tag such as `v1.2.0` only when `mobile/app.json` contains version `1.2.0`.
- The workflow verifies the APK signature and checksum before publication.
- A manual workflow run builds an artifact but does not publish a GitHub Release.
- The workflow fails safely when signing secrets are missing. Do not put signing credentials in source code.

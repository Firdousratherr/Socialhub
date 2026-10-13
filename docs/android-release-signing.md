# Android release signing

Socialhub production APKs must be signed with the **same private key for every release**. Do not generate a new key for each build.

## Configure GitHub Actions

1. Create or recover the one long-lived release keystore. Keep an encrypted offline backup. Never commit the keystore or passwords to Git.
2. Add these repository Actions secrets under **Settings → Secrets and variables → Actions**:
   - `ANDROID_KEYSTORE_BASE64`: the base64-encoded PKCS12/JKS keystore file.
   - `ANDROID_KEYSTORE_PASSWORD`: keystore password.
   - `ANDROID_KEY_PASSWORD`: private-key password.
   - `ANDROID_KEY_ALIAS`: alias inside the keystore.
3. A Linux/macOS shell can encode the binary file without adding a newline using `base64 -w 0 socialhub-release.keystore` (on macOS, use `base64 < socialhub-release.keystore | tr -d '\n'`).
4. Test the configured signing key with a manual workflow dispatch. Manual runs build and upload an artifact but **do not publish a GitHub Release**.
5. Publish only by pushing a version tag matching `mobile/app.json`, for example `v1.2.0` when the Expo version is `1.2.0`. The workflow validates the tag and verifies the APK signature before publishing.

## Important migration warning

The previous workflow generated random signing passwords and a new keystore on each run, then did not retain the private keystore as an artifact. As a result, an old APK may not be updatable in place unless its original signing key can be recovered from a secure backup. Android rejects an APK signed with a different certificate as an update. Verify the certificate of the APK already installed by users and the candidate APK before publishing; if the old key is unrecoverable, explicitly plan the one-time uninstall/reinstall migration and warn users before release.

Never publish a new APK just to test the pipeline. Use the workflow-dispatch artifact for validation.

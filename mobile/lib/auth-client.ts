import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://socialhublive.vercel.app";

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: "socialhub",
      storagePrefix: "socialhub",
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
});

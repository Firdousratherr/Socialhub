import { authClient } from "./auth-client";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://socialhub-ruby.vercel.app";

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cookie = await authClient.getCookie();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookie) headers.set("Cookie", cookie);

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    { ...init, headers, credentials: "omit" },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `Request failed (${response.status})`,
    );
  }
  return data as T;
}
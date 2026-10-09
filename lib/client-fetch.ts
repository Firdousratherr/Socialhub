/**
 * Fetch helper for interactive admin screens.
 *
 * Reads the response body within the timeout so a stalled stream cannot leave
 * the interface in a permanent loading state. Returns a JSON error response
 * for transport failures, matching the admin API response shape.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const body = await response.text();
    const hasNullBodyStatus = [204, 205, 304].includes(response.status);

    return new Response(hasNullBodyStatus ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    const message = callerSignal?.aborted
      ? "The request was cancelled."
      : controller.signal.aborted
        ? "The request timed out. Please retry."
        : "Could not reach the service. Check your connection and try again.";

    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

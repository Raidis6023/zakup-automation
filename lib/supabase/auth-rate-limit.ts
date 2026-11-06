/**
 * GoTrue can reject bursts of session refresh calls with 429, and
 * occasionally report temporary 502/503 upstream failures.
 * These errors do not mean the user's signed session was revoked.
 */
export function isTemporaryAuthFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { status?: number; code?: string; message?: string };
  return value.status === 429 || value.status === 502 || value.status === 503 ||
    value.status === 504 || value.code === "over_request_rate_limit" ||
    value.code === "over_email_send_rate_limit" ||
    value.code === "request_timeout";
}

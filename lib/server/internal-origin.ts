/**
 * Internal server-to-server origin. Never fall back to an external Vercel URL:
 * a wrongly configured scheduler must fail closed during Docker migration.
 */
export function getInternalAppOrigin(): string {
  const configured = process.env.INTERNAL_APP_URL?.trim();
  if (!configured) {
    throw new Error("Не настроен INTERNAL_APP_URL для внутренних заданий ПАНДЫ");
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("INTERNAL_APP_URL должен быть корректным HTTP(S) адресом");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("INTERNAL_APP_URL должен содержать только HTTP(S) адрес сервиса");
  }
  return url.origin;
}

// This alias uses session cookies and must render per request.
// Without segment config Next.js tries to prerender /registry at build time.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export { default } from "../ved/registry/page";

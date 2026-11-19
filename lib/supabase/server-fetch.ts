import "server-only";

/**
 * Keep the browser-visible Supabase URL for signed URLs and Auth links.
 * Route server-side requests across the private Docker network when set.
 *
 * Crucially, rewriting the Supabase client base URL itself would expose
 * internal Docker hostnames in Storage signed URLs sent to browsers.
 */
export function getServerSupabaseFetch(): typeof fetch {
  const external = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const internal = process.env.SUPABASE_INTERNAL_URL?.trim();
  if (!external || !internal) return fetch;

  const publicOrigin = new URL(external).origin;
  const privateOrigin = new URL(internal).origin;
  if (!["http:", "https:"].includes(new URL(internal).protocol)) {
    throw new Error("Invalid SUPABASE_INTERNAL_URL scheme");
  }

  return (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    const target = new URL(raw);
    if (target.origin !== publicOrigin) {
      return fetch(input, init);
    }
    const internalUrl = privateOrigin + target.pathname + target.search + target.hash;
    if (input instanceof Request) {
      return fetch(new Request(internalUrl, input), init);
    }
    return fetch(internalUrl, init);
  };
}

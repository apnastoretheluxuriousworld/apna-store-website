import "server-only";
import { headers } from "next/headers";

/**
 * The visitor's IP, for rate limiting. Only a header that the hosting platform
 * itself sets can be trusted: anything else is typed by the visitor, and a
 * faked IP per request would switch every per-network limit off.
 *
 * - Vercel: `x-real-ip` (set by Vercel's edge, overwriting what the visitor sent).
 * - Netlify: `x-nf-client-connection-ip`.
 * - VPS behind nginx/Caddy: set CLIENT_IP_HEADER to the header the proxy sets
 *   (e.g. `x-real-ip` with `proxy_set_header X-Real-IP $remote_addr;`).
 * - Local `next dev` / `next start` with no proxy: Next fills `x-forwarded-for`
 *   with the socket address only when the request has none, so it is used for
 *   development only.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const configured = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const name = configured || (process.env.VERCEL ? "x-real-ip" : process.env.NETLIFY ? "x-nf-client-connection-ip" : null);
  if (name) return clean(h.get(name));

  if (process.env.NODE_ENV === "production") warnOnce();
  return clean(h.get("x-forwarded-for")?.split(",")[0]);
}

/** Bounded, so a junk header can't create huge rate-limit keys. */
function clean(v: string | null | undefined) {
  const ip = v?.trim();
  return ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "[security] No trusted client-IP header: set CLIENT_IP_HEADER (e.g. x-real-ip behind nginx). " +
      "Per-network rate limits are using x-forwarded-for, which visitors can fake.",
  );
}

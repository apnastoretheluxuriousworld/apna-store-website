import type { NextConfig } from "next";

// Media served from the bucket's public URL (R2 r2.dev or a custom domain).
// Only that exact host: a wildcard like **.r2.dev would let anyone's bucket be
// fetched and re-served through this site's image optimizer.
function mediaPatterns() {
  const patterns: { protocol: "https"; hostname: string }[] = [];
  try {
    const host = new URL(process.env.S3_PUBLIC_URL ?? "").hostname;
    if (host) patterns.push({ protocol: "https", hostname: host });
  } catch {
    console.warn("[next.config] S3_PUBLIC_URL is not set: remote images won't load.");
  }
  return patterns;
}

/*
 * Security headers for every response.
 * - HSTS: browsers only ever use HTTPS for this site after the first visit.
 * - frame-ancestors / X-Frame-Options: no other site can show these pages in a
 *   frame (stops "clickjacking" the admin's buttons).
 * - nosniff, Referrer-Policy, Permissions-Policy: standard hardening.
 * A script CSP isn't set: nonce-based CSP needs fully dynamic rendering, which
 * Cache Components/PPR rule out (see the Next CSP guide).
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/** Private areas: never in search results. */
const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: noIndex },
      { source: "/admin", headers: noIndex },
      { source: "/account/:path*", headers: noIndex },
      { source: "/order/:path*", headers: noIndex },
    ];
  },
  images: {
    remotePatterns: mediaPatterns(),
    formats: ["image/avif", "image/webp"],
  },
  // Dev only: let phones on the same Wi-Fi load the dev server by LAN IP
  // (e.g. http://10.20.210.140:3000). Without this Next blocks dev scripts,
  // the page never hydrates, and animated content stays invisible.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    /*
     * Admin pages are cached in the browser only ('use cache: private'), so
     * moving between admin pages is instant instead of re-querying the DB.
     * - stale: how long the browser reuses a visited/prefetched admin page.
     *   5 min is also the threshold for joining the per-session App Shell, so
     *   sidebar links are prefetched with real data before the click.
     * - Every admin Server Action calls revalidatePath("/admin", "layout"),
     *   which wipes this browser cache at once — your own edits always show.
     * - Changes made elsewhere (customers' orders, another device) appear
     *   after `stale` runs out or on a full reload.
     */
    admin: { stale: 300, revalidate: 300, expire: 3600 },
    /*
     * Customer account pages (/account, /account/profile, order pages): same
     * browser-only caching, so switching tabs is instant and links prefetch
     * with real data. Sign in/out/up and profile saves wipe it at once
     * (revalidatePath("/account", "layout")). A status change made by the
     * store shows after `stale` or on reload.
     */
    account: { stale: 300, revalidate: 300, expire: 3600 },
    /*
     * Storefront data (products, collections, reviews, banners, settings):
     * fetched once and shared by every visitor from the server cache.
     * - revalidate 2 h: after that the next visitor still gets the cached
     *   copy instantly and a fresh one is fetched in the background.
     * - Admin edits don't wait for this: they invalidate the matching cache
     *   tag (products, categories, reviews, settings…) so changes show at once.
     * - stale 5 min: the browser reuses a visited page without asking the server.
     */
    store: { stale: 300, revalidate: 7200, expire: 86400 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { getStoreCategories } from "@/lib/data/categories";

/** Newest warm-up asked for in this server instance (older ones step aside). */
let latest = 0;

/**
 * After an admin edit clears a storefront cache, load the main store pages
 * once in the background so the cache is rebuilt by the server, not by the
 * next customer (who would otherwise get the slower first load).
 *
 * Call from Server Actions only, right after updateTag(). Runs after the
 * response is sent (after()), so the admin never waits for it. Skipped in
 * `next dev`, where every fetch would compile pages.
 */
export function warmStore(extraPaths: string[] = []) {
  if (process.env.NODE_ENV !== "production") return;
  const me = ++latest;
  after(async () => {
    try {
      // A burst of saves (e.g. reordering) → one warm-up, a few seconds after the last one.
      await new Promise((r) => setTimeout(r, 4000));
      if (me !== latest) return;
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      if (!host) return;
      const origin = `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
      const categories = await getStoreCategories();
      const paths = new Set(["/", "/shop", "/offers", ...categories.map((c) => `/shop/${c.slug}`), ...extraPaths]);
      await Promise.allSettled(
        [...paths].map((p) =>
          // Read the whole response: the page's data streams in after the shell,
          // and stopping early could stop the server before it is cached.
          fetch(origin + p, { cache: "no-store", headers: { "x-cache-warmup": "1" }, signal: AbortSignal.timeout(20_000) }).then((r) =>
            r.arrayBuffer(),
          ),
        ),
      );
    } catch {
      /* best effort: the next visitor rebuilds the cache instead */
    }
  });
}

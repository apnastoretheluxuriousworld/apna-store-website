import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema as s } from "@/lib/db";
import { ROLE_HINT_COOKIE } from "@/lib/auth/role-hint-cookie";

/** Crawlers, link previews, uptime checkers and headless browsers. */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|lighthouse|headless|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nothing = () => new Response(null, { status: 204 });

/**
 * POST /api/visit — one store page view, sent by <VisitTracker> (navigator.sendBeacon).
 * Body: {"v": "<random id this browser made up>"}. Stores one row per browser per
 * day (India time) and counts its views; skips bots, other sites and the admin.
 * Always answers 204 so it never shows an error to a shopper.
 */
export async function POST(request: Request) {
  await connection();
  const h = request.headers;
  const ua = h.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return nothing();
  // Only beacons from our own pages (browsers set this header themselves).
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin") return nothing();
  // The admin's own browsing isn't store traffic.
  if (h.get("cookie")?.split("; ").includes(`${ROLE_HINT_COOKIE}=admin`)) return nothing();

  let v: unknown;
  try {
    v = (JSON.parse(await request.text()) as { v?: unknown }).v;
  } catch {
    return nothing();
  }
  if (typeof v !== "string" || !UUID.test(v)) return nothing();

  const device = /mobi|android|iphone|ipad|ipod/i.test(ua) ? "mobile" : "desktop";
  try {
    await db()
      .insert(s.siteVisits)
      .values({ day: sql`(now() at time zone 'Asia/Kolkata')::date`, visitorId: v.toLowerCase(), device })
      .onConflictDoUpdate({
        target: [s.siteVisits.day, s.siteVisits.visitorId],
        // Capped so one script can't inflate a day's page views without limit.
        set: { views: sql`least(${s.siteVisits.views} + 1, 500)` },
      });
  } catch (e) {
    console.warn("[visit]", e instanceof Error ? e.message : e);
  }
  return nothing();
}

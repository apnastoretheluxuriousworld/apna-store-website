import "server-only";
import { inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";
import { defaultStoreInfo, type StoreInfoValues } from "@/lib/validation/settings";

/** Settings actions call updateTag(SETTINGS_TAG) to refresh the storefront. */
export const SETTINGS_TAG = "settings";

/** Store details as the storefront uses them (footer, Contact page). */
export type StoreInfo = {
  phones: { label: string; tel: string }[];
  whatsappUrl: string | null;
  instagram: { url: string; handle: string } | null;
  youtubeUrl: string | null;
  email: string;
  addressLines: string[];
  mapsUrl: string | null;
};

/** Raw values, merged over the defaults (the seeded "store" row has a different, older shape). */
async function readStoreValues(): Promise<StoreInfoValues> {
  const rows = await db()
    .select()
    .from(s.settings)
    .where(inArray(s.settings.key, ["store", "whatsapp_number"]));
  const store = (rows.find((r) => r.key === "store")?.value ?? {}) as Partial<StoreInfoValues> & { configured?: boolean };
  const wa = rows.find((r) => r.key === "whatsapp_number")?.value;
  // Until the admin saves this form once, show the visiting-card details.
  if (!store.configured) return defaultStoreInfo;
  return {
    ...defaultStoreInfo,
    ...Object.fromEntries(Object.entries(store).filter(([k]) => k in defaultStoreInfo)),
    // A digits-only jsonb string can come back from the driver as a number.
    whatsapp: typeof wa === "string" || typeof wa === "number" ? String(wa) : "",
  };
}

const tel = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `+91${d}` : `+${d}`;
};

function instagramHandle(url: string) {
  const name = new URL(url).pathname.split("/").filter(Boolean)[0];
  return name ? `@${name}` : "Instagram";
}

export function toStoreInfo(v: StoreInfoValues): StoreInfo {
  const addressLines = v.address.split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    phones: [v.phone, v.phone2].filter(Boolean).map((p) => ({ label: p, tel: tel(p) })),
    whatsappUrl: v.whatsappGroup || (v.whatsapp ? `https://wa.me/${v.whatsapp}` : null),
    instagram: v.instagram ? { url: v.instagram, handle: instagramHandle(v.instagram) } : null,
    youtubeUrl: v.youtube || null,
    email: v.email,
    addressLines,
    mapsUrl: addressLines.length
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Apna Store, ${addressLines.join(", ")}`)}`
      : null,
  };
}

export async function getStoreInfo(): Promise<StoreInfo> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  try {
    const v = await readStoreValues();
    cacheLife("store");
    return toStoreInfo(v);
  } catch (e) {
    console.warn("[settings] store info query failed:", e instanceof Error ? e.message : e);
    cacheLife("minutes");
    return toStoreInfo(defaultStoreInfo);
  }
}

/* ───────────── Admin (private-cached; call after requireAdminView()) ───────────── */

export async function getStoreValuesForAdmin() {
  "use cache: private";
  cacheLife("admin");
  return readStoreValues();
}

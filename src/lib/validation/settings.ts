/**
 * Store details (Admin → Settings) — shared by the admin form and the Server Action.
 * Stored in the `settings` table: key "store" (everything below except
 * `whatsapp`) and key "whatsapp_number" (digits with country code).
 */
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`).optional().default("");
const link = (host: RegExp, example: string) =>
  z
    .string()
    .trim()
    .max(300)
    .optional()
    .default("")
    .refine((v) => !v || (/^https:\/\//.test(v) && host.test(v)), `Paste the full link, e.g. ${example}`);

export const storeInfoSchema = z.object({
  phone: text(20),
  phone2: text(20),
  /** For "Chat on WhatsApp" (wa.me). 10-digit Indian numbers get +91. */
  whatsapp: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => {
      const d = v.replace(/\D/g, "");
      return d.length === 10 ? `91${d}` : d;
    })
    .refine((d) => !d || (d.length >= 11 && d.length <= 15), "Enter the number with country code, e.g. 91 96663 51344"),
  whatsappGroup: link(/chat\.whatsapp\.com\//, "https://chat.whatsapp.com/…"),
  instagram: link(/instagram\.com\//, "https://www.instagram.com/apna_store_1"),
  youtube: link(/(youtube\.com|youtu\.be)\//, "https://www.youtube.com/@yourchannel"),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional().default(""),
  /** One line per row; the first two show in the footer. */
  address: text(300),
});

export type StoreInfoInput = z.input<typeof storeInfoSchema>;
export type StoreInfoValues = z.output<typeof storeInfoSchema>;

/** Starting values (from the shop's visiting card). */
export const defaultStoreInfo: StoreInfoValues = {
  phone: "+91 96663 51344",
  phone2: "+91 95737 67831",
  whatsapp: "919666351344",
  whatsappGroup: "",
  instagram: "https://www.instagram.com/apna_store_1/",
  youtube: "",
  email: "",
  address: "Jama Masjid Complex, Chinna Bazar\nKothagudem – 507101\nBhadradri Kothagudem Dt., Telangana",
};

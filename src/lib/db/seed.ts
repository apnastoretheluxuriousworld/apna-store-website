/**
 * Idempotent seed: categories (+ their product fields), homepage section order
 * and default settings. Safe to run repeatedly — existing rows are never
 * overwritten, so admin edits survive a re-seed.
 *
 * Takes a Drizzle instance so it runs from the CLI script and from tests.
 */
import { eq as sqlEq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "./schema";

type Field = {
  label: string;
  key: string;
  type?: "text" | "number" | "select" | "boolean";
  options?: string[];
  unit?: string;
  required?: boolean;
  filterable?: boolean;
};

const brand: Field = { label: "Brand", key: "brand", required: true, filterable: true };
const gender: Field = {
  label: "Gender",
  key: "gender",
  type: "select",
  options: ["Men", "Women", "Unisex"],
  filterable: true,
};
const color: Field = { label: "Colour", key: "color", filterable: true };

export const seedCategories: {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  fields: Field[];
}[] = [
  {
    name: "Watches",
    slug: "watches",
    description: "Timepieces of distinction",
    imageUrl: "/demo/watches/aurum-chronograph.webp",
    fields: [
      brand,
      { label: "Movement", key: "movement", type: "select", options: ["Automatic", "Quartz", "Manual", "Chronograph"], filterable: true },
      { label: "Case Size", key: "case_size", type: "number", unit: "mm" },
      { label: "Case Material", key: "case_material", type: "select", options: ["Stainless Steel", "Gold", "Rose Gold", "Ceramic", "Titanium"], filterable: true },
      { label: "Strap", key: "strap", type: "select", options: ["Metal Bracelet", "Leather", "Rubber", "Ceramic"], filterable: true },
      { label: "Dial Colour", key: "dial_color" },
      { label: "Water Resistance", key: "water_resistance", unit: "m" },
      gender,
    ],
  },
  {
    name: "Handbags",
    slug: "handbags",
    description: "Icons for her",
    imageUrl: "/demo/handbags/bordeaux-flap-bag.webp",
    fields: [
      brand,
      { label: "Style", key: "style", type: "select", options: ["Tote", "Shoulder Bag", "Crossbody", "Top Handle", "Clutch", "Backpack"], filterable: true },
      { label: "Material", key: "material", filterable: true },
      color,
      { label: "Dimensions", key: "dimensions", unit: "cm" },
      { label: "Closure", key: "closure" },
    ],
  },
  {
    name: "Shoes",
    slug: "shoes",
    description: "Crafted for every step",
    imageUrl: "/demo/shoes/monk-strap-patent.webp",
    fields: [
      brand,
      { label: "Style", key: "style", type: "select", options: ["Oxford", "Loafer", "Monk Strap", "Derby", "Sneaker", "Boot", "Heels"], filterable: true },
      { label: "Upper Material", key: "material", filterable: true },
      color,
      { label: "Sole", key: "sole" },
      gender,
    ],
  },
  {
    name: "Sunglasses",
    slug: "sunglasses",
    description: "Statement eyewear",
    imageUrl: "/demo/sunglasses/regal-shield.webp",
    fields: [
      brand,
      { label: "Frame Shape", key: "frame_shape", type: "select", options: ["Aviator", "Square", "Round", "Shield", "Cat-eye", "Rectangle"], filterable: true },
      { label: "Frame Material", key: "frame_material" },
      { label: "Lens", key: "lens", type: "select", options: ["Polarised", "UV400", "Gradient", "Mirrored"], filterable: true },
      gender,
    ],
  },
  {
    name: "Wallets",
    slug: "wallets",
    description: "Refined essentials",
    imageUrl: "/demo/wallets/heritage-bifold-tan.webp",
    fields: [
      brand,
      { label: "Style", key: "style", type: "select", options: ["Bifold", "Card Holder", "Long Wallet", "Zip Around"], filterable: true },
      { label: "Material", key: "material" },
      color,
      { label: "Card Slots", key: "card_slots", type: "number" },
      { label: "RFID Protected", key: "rfid", type: "boolean" },
    ],
  },
  {
    name: "Belts",
    slug: "belts",
    description: "The finishing detail",
    imageUrl: "/demo/belts/stallion-buckle-belt.webp",
    fields: [
      brand,
      { label: "Material", key: "material" },
      { label: "Buckle", key: "buckle", type: "select", options: ["Auto-lock", "Pin", "Plate", "Reversible"], filterable: true },
      { label: "Width", key: "width", type: "number", unit: "cm" },
      color,
    ],
  },
  {
    name: "Caps",
    slug: "caps",
    description: "Crowned in style",
    imageUrl: "/demo/caps/crystal-crest-cap.webp",
    fields: [
      brand,
      { label: "Style", key: "style", type: "select", options: ["Baseball", "Bucket", "Snapback", "Trucker"], filterable: true },
      { label: "Material", key: "material" },
      color,
      { label: "Adjustable", key: "adjustable", type: "boolean" },
    ],
  },
  {
    name: "Perfumes",
    slug: "perfumes",
    description: "Signature scents",
    imageUrl: "/demo/perfumes/velora-eau-de-parfum.webp",
    fields: [
      brand,
      { label: "Concentration", key: "concentration", type: "select", options: ["Eau de Parfum", "Eau de Toilette", "Extrait de Parfum", "Attar", "Cologne"], filterable: true },
      { label: "Volume", key: "volume", type: "number", unit: "ml", required: true },
      { label: "Fragrance Family", key: "family", type: "select", options: ["Oud", "Woody", "Floral", "Oriental", "Fresh", "Citrus", "Musk"], filterable: true },
      { label: "Top Notes", key: "top_notes" },
      { label: "Heart Notes", key: "heart_notes" },
      { label: "Base Notes", key: "base_notes" },
      gender,
    ],
  },
];

export const seedHomepageSections: { type: (typeof s.homepageSectionType.enumValues)[number]; title: string }[] = [
  { type: "hero", title: "Hero" },
  { type: "reels", title: "The Film Room" },
  { type: "categories", title: "Explore Collections" },
  { type: "featured", title: "Best Sellers" },
  { type: "testimonials", title: "Loved by connoisseurs" },
];

export const seedSettings: Record<string, unknown> = {
  cod_min_order: 500, // COD allowed only when order total ≥ this (₹)
  cod_enabled: true,
  shipping_fee: 0, // flat ₹
  free_shipping_above: 0, // 0 = always free
  whatsapp_number: "", // e.g. "919876543210"
  store: { name: "Apna Store", tagline: "The Luxurious World", email: "", phone: "", address: "" },
};

export async function seed<T extends PgQueryResultHKT>(db: PgDatabase<T, typeof s>) {
  const report = { categories: 0, fields: 0, sections: 0, settings: 0 };

  for (const [i, c] of seedCategories.entries()) {
    const inserted = await db
      .insert(s.categories)
      .values({ name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, sortOrder: i })
      .onConflictDoNothing({ target: s.categories.slug })
      .returning({ id: s.categories.id });
    report.categories += inserted.length;

    const [cat] = await db
      .select({ id: s.categories.id })
      .from(s.categories)
      .where(sqlEq(s.categories.slug, c.slug));

    const rows = c.fields.map((f, j) => ({
      categoryId: cat.id,
      label: f.label,
      key: f.key,
      type: f.type ?? "text",
      options: f.options ?? [],
      unit: f.unit ?? null,
      required: f.required ?? false,
      filterable: f.filterable ?? false,
      sortOrder: j,
    }));
    const insertedFields = await db
      .insert(s.categoryFields)
      .values(rows)
      .onConflictDoNothing({ target: [s.categoryFields.categoryId, s.categoryFields.key] })
      .returning({ id: s.categoryFields.id });
    report.fields += insertedFields.length;
  }

  const sections = await db
    .insert(s.homepageSections)
    .values(seedHomepageSections.map((sec, i) => ({ ...sec, sortOrder: i })))
    .onConflictDoNothing({ target: s.homepageSections.type })
    .returning({ id: s.homepageSections.id });
  report.sections = sections.length;

  const settingRows = await db
    .insert(s.settings)
    .values(Object.entries(seedSettings).map(([key, value]) => ({ key, value })))
    .onConflictDoNothing({ target: s.settings.key })
    .returning({ key: s.settings.key });
  report.settings = settingRows.length;

  return report;
}

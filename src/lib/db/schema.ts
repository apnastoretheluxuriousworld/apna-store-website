/**
 * Apna Store database schema (plain Postgres — no Supabase-specific features,
 * so it moves to any Postgres server with pg_dump/pg_restore).
 *
 * Conventions
 * - Column names are camelCase here and snake_case in SQL (drizzle `casing`).
 * - Money is stored as whole rupees (integer). Razorpay amounts are rupees × 100.
 * - Every table has uuid ids and created/updated timestamps where useful.
 * - Every table has RLS enabled with NO policies: Supabase's public REST API
 *   (anon key) can't touch any row, while the app's owner connection is
 *   unaffected. Add `.enableRLS()` to every new table.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ───────────── Shared helpers ───────────── */

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const sortOrder = () => integer().notNull().default(0);

/* ───────────── Enums ───────────── */

export const userRole = pgEnum("user_role", ["customer", "admin"]);
export const fieldType = pgEnum("field_type", ["text", "number", "select", "boolean"]);
export const productStatus = pgEnum("product_status", ["draft", "active"]);
export const paymentMethod = pgEnum("payment_method", ["razorpay", "cod"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "failed", "refunded"]);
export const orderStatus = pgEnum("order_status", [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
]);
export const couponType = pgEnum("coupon_type", ["percent", "flat"]);
export const mediaType = pgEnum("media_type", ["image", "video"]);
export const homepageSectionType = pgEnum("homepage_section_type", [
  "hero",
  "reels",
  "categories",
  "featured",
  "testimonials",
]);

/* ───────────── Users & auth ───────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text().notNull(),
    // Login id. Customers sign in with phone (10 digits); admins may use a
    // username instead. At least one is required.
    phone: text().unique(),
    username: text().unique(), // stored lower-case
    passwordHash: text().notNull(),
    role: userRole().notNull().default("customer"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("users_login_id", sql`${t.phone} is not null or ${t.username} is not null`)],
).enableRLS();

/** Failed-login counters for rate limiting (keys like "id:apnastore", "ip:1.2.3.4"). */
export const loginAttempts = pgTable("login_attempts", {
  key: text().primaryKey(),
  failures: integer().notNull().default(0),
  resetAt: timestamp({ withTimezone: true }).notNull(),
}).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    id: text().primaryKey(), // SHA-256 of the session token (raw token lives only in the cookie)
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
).enableRLS();

export type ShippingAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
};

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text().notNull(),
    phone: text().notNull(),
    line1: text().notNull(),
    line2: text(),
    landmark: text(),
    city: text().notNull(),
    state: text().notNull(),
    pincode: text().notNull(),
    isDefault: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
).enableRLS();

/* ───────────── Catalog ───────────── */

export const categories = pgTable("categories", {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  description: text(),
  imageUrl: text(),
  sortOrder: sortOrder(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

/** Field definitions per category; values live in products.attributes[key]. */
export const categoryFields = pgTable(
  "category_fields",
  {
    id: id(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    label: text().notNull(),
    key: text().notNull(),
    type: fieldType().notNull().default("text"),
    options: jsonb().$type<string[]>().notNull().default([]), // for "select"
    unit: text(), // e.g. "mm", "ml"
    required: boolean().notNull().default(false),
    filterable: boolean().notNull().default(false), // shown as a storefront filter
    sortOrder: sortOrder(),
  },
  (t) => [uniqueIndex().on(t.categoryId, t.key)],
).enableRLS();

export type AttributeValue = string | number | boolean;
export type CustomAttribute = { name: string; value: string };

export const products = pgTable(
  "products",
  {
    id: id(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: text().notNull(),
    slug: text().notNull().unique(),
    description: text(),
    price: integer().notNull(),
    compareAtPrice: integer(),
    stock: integer().notNull().default(0),
    sku: text(),
    status: productStatus().notNull().default("draft"),
    isFeatured: boolean().notNull().default(false),
    featuredOrder: sortOrder(),
    /** Values for the category's fields: { [field.key]: value } */
    attributes: jsonb().$type<Record<string, AttributeValue>>().notNull().default({}),
    /** Extra name/value pairs that apply to this product only */
    customAttributes: jsonb().$type<CustomAttribute[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.categoryId, t.status),
    index().on(t.isFeatured, t.featuredOrder),
    check("price_non_negative", sql`${t.price} >= 0`),
    check("stock_non_negative", sql`${t.stock} >= 0`),
  ],
).enableRLS();

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text().notNull(),
    storageKey: text(), // object key in the bucket, for deletes
    alt: text(),
    sortOrder: sortOrder(),
  },
  (t) => [index().on(t.productId, t.sortOrder)],
).enableRLS();

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text().notNull(), // e.g. "UK 8", "Black / Gold"
    sku: text(),
    priceOverride: integer(),
    stock: integer().notNull().default(0),
    sortOrder: sortOrder(),
  },
  (t) => [index().on(t.productId)],
).enableRLS();

/* ───────────── Orders ───────────── */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    orderNumber: text().notNull().unique(), // human-friendly, e.g. AS-100245
    userId: uuid().references(() => users.id, { onDelete: "set null" }), // null = guest
    customerName: text().notNull(),
    customerPhone: text().notNull(),
    shippingAddress: jsonb().$type<ShippingAddress>().notNull(),
    subtotal: integer().notNull(),
    shippingFee: integer().notNull().default(0),
    discount: integer().notNull().default(0),
    total: integer().notNull(),
    couponCode: text(),
    paymentMethod: paymentMethod().notNull(),
    paymentStatus: paymentStatus().notNull().default("pending"),
    status: orderStatus().notNull().default("placed"),
    razorpayOrderId: text().unique(),
    razorpayPaymentId: text(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId), index().on(t.status, t.createdAt)],
).enableRLS();

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    variantId: uuid().references(() => productVariants.id, { onDelete: "set null" }),
    // Snapshot at purchase time — survives product edits/deletes
    name: text().notNull(),
    variantLabel: text(),
    imageUrl: text(),
    unitPrice: integer().notNull(),
    quantity: integer().notNull(),
  },
  (t) => [index().on(t.orderId)],
).enableRLS();

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatus().notNull(),
    note: text(),
    changedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.orderId)],
).enableRLS();

export const coupons = pgTable("coupons", {
  id: id(),
  code: text().notNull().unique(), // stored upper-case
  type: couponType().notNull(),
  value: integer().notNull(), // percent (1–100) or flat rupees
  minOrder: integer().notNull().default(0),
  maxUses: integer(),
  usedCount: integer().notNull().default(0),
  expiresAt: timestamp({ withTimezone: true }),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

/* ───────────── Engagement ───────────── */

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: smallint().notNull(),
    body: text(),
    isApproved: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex().on(t.productId, t.userId),
    check("rating_range", sql`${t.rating} between 1 and 5`),
  ],
).enableRLS();

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
).enableRLS();

/* ───────────── Homepage CMS ───────────── */

export const homepageSections = pgTable("homepage_sections", {
  id: id(),
  type: homepageSectionType().notNull().unique(),
  title: text(),
  sortOrder: sortOrder(),
  isActive: boolean().notNull().default(true),
}).enableRLS();

export const heroSlides = pgTable("hero_slides", {
  id: id(),
  eyebrow: text(),
  title: text().notNull(),
  highlight: text(), // italic gold word, e.g. "Presence."
  subtitle: text(),
  ctaLabel: text(),
  ctaHref: text(),
  mediaType: mediaType().notNull().default("image"),
  mediaUrl: text().notNull(),
  mobileMediaUrl: text(),
  posterUrl: text(),
  sortOrder: sortOrder(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

export const reels = pgTable("reels", {
  id: id(),
  title: text().notNull(),
  videoUrl: text().notNull(),
  posterUrl: text(),
  productId: uuid().references(() => products.id, { onDelete: "set null" }),
  sortOrder: sortOrder(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

export const testimonials = pgTable("testimonials", {
  id: id(),
  name: text().notNull(),
  city: text(),
  body: text(),
  rating: smallint().notNull().default(5),
  mediaType: mediaType(), // null = text-only
  mediaUrl: text(),
  posterUrl: text(),
  sortOrder: sortOrder(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

/* ───────────── Settings (key/value) ───────────── */

export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: updatedAt(),
}).enableRLS();

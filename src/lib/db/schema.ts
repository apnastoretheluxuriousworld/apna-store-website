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
  type AnyPgColumn,
  boolean,
  check,
  date,
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
/** upi = customer scans the store's QR, uploads a screenshot, the admin verifies it. */
export const paymentMethod = pgEnum("payment_method", ["razorpay", "cod", "upi"]);
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
    /** Blocked accounts can't sign in; their sessions are ended when blocked. */
    isBlocked: boolean().notNull().default(false),
    lastLoginAt: timestamp({ withTimezone: true }),
    /** Private note from the store about this customer (admin only). */
    adminNote: text(),
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
    /** false = made to order / always available: stock isn't counted and it never sells out. */
    trackStock: boolean().notNull().default(true),
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
    /** Cash on delivery charge (set in admin), included in the total. */
    codFee: integer().notNull().default(0),
    /** Return charge the customer agreed to at checkout (null = none shown). Not part of the total. */
    returnFee: integer(),
    discount: integer().notNull().default(0),
    total: integer().notNull(),
    /** The code as typed at checkout (kept even if the coupon is later edited or deleted). */
    couponCode: text(),
    couponId: uuid().references((): AnyPgColumn => coupons.id, { onDelete: "set null" }),
    /** The coupon's influencer and the commission they earn on this order, fixed when it's placed. */
    influencerId: uuid().references((): AnyPgColumn => influencers.id, { onDelete: "set null" }),
    commission: integer().notNull().default(0),
    paymentMethod: paymentMethod().notNull(),
    paymentStatus: paymentStatus().notNull().default("pending"),
    status: orderStatus().notNull().default("placed"),
    razorpayOrderId: text().unique(),
    razorpayPaymentId: text(),
    /** Secret for the order's status page (/order/<token>), so guests can follow their order. */
    accessToken: text().unique(),
    /** UPI: the customer's payment screenshot and UTR / transaction id. */
    paymentProofUrl: text(),
    paymentReference: text(),
    /** Why the store rejected a payment screenshot (shown to the customer). */
    paymentNote: text(),
    paymentVerifiedAt: timestamp({ withTimezone: true }),
    /** COD: when the customer ticked "I'll pay cash on delivery". */
    codConsentAt: timestamp({ withTimezone: true }),
    notes: text(),
    // Shipment tracking, filled in by the store when the order ships.
    courierName: text(),
    trackingNumber: text(),
    trackingUrl: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId), index().on(t.status, t.createdAt), index().on(t.couponId), index().on(t.influencerId), index().on(t.customerPhone)],
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
    /**
     * Bought as part of an offer bundle ("Any 3 for ₹1,000"): the offer, its title
     * at the time, and which bundle of the order (1, 2…) the item belongs to.
     * unitPrice is then this item's share of the bundle price.
     */
    offerId: uuid().references((): AnyPgColumn => offers.id, { onDelete: "set null" }),
    offerTitle: text(),
    bundleNo: smallint(),
  },
  (t) => [index().on(t.orderId), index().on(t.offerId)],
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

/** A partner (influencer, page, affiliate) who promotes the store with their own coupon codes. */
export const influencers = pgTable("influencers", {
  id: id(),
  name: text().notNull(),
  /** Instagram / YouTube handle, without the @. */
  handle: text(),
  phone: text(),
  /** % of the order value (after discount, before shipping) they earn on delivered orders. 0 = none. */
  commissionPercent: integer().notNull().default(0),
  notes: text(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

/**
 * Discount codes. How many times a code was used is counted from orders
 * (cancelled ones don't count), so a cancellation gives the use back.
 */
export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: text().notNull().unique(), // stored upper-case
    type: couponType().notNull(),
    value: integer().notNull(), // percent (1–100) or flat rupees
    /** Percent coupons: most it can take off, in rupees (null = no cap). */
    maxDiscount: integer(),
    minOrder: integer().notNull().default(0),
    /** Total uses across all customers (null = unlimited). */
    maxUses: integer(),
    /** Uses per customer, matched by mobile number (null = unlimited). */
    perCustomerLimit: integer().default(1),
    /** Only for customers with no earlier order. */
    firstOrderOnly: boolean().notNull().default(false),
    influencerId: uuid().references(() => influencers.id, { onDelete: "set null" }),
    /** Internal note for the store (never shown to customers). */
    note: text(),
    startsAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.influencerId)],
).enableRLS();

/**
 * Combo offers ("Any 3 for ₹1,000"): the customer picks `pickCount` of the
 * offer's products and pays `price` for all of them. Shown under the Feed on
 * the homepage, each with its own page (/offers/<slug>). Coupons never apply
 * to offer items, and the same products bought normally cost full price.
 */
export const offers = pgTable(
  "offers",
  {
    id: id(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    description: text(),
    coverUrl: text().notNull(),
    pickCount: smallint().notNull(),
    price: integer().notNull(),
    sortOrder: sortOrder(),
    isActive: boolean().notNull().default(true),
    startsAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("offers_pick_count_check", sql`${t.pickCount} between 1 and 10`), check("offers_price_check", sql`${t.price} > 0`)],
).enableRLS();

/** The products a customer can choose from in an offer, in the admin's order. */
export const offerProducts = pgTable(
  "offer_products",
  {
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sortOrder: sortOrder(),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.productId] }), index().on(t.productId)],
).enableRLS();

/* ───────────── Engagement ───────────── */

/** A photo or video attached to a review. `poster` = still frame shown before a video plays. */
export type ReviewMedia = { type: "image" | "video"; url: string; poster?: string | null };

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // Null for reviews the admin enters by hand (e.g. from WhatsApp/Instagram).
    // A deleted account keeps its review under `authorName`.
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    authorName: text().notNull(),
    city: text(),
    rating: smallint().notNull(),
    body: text(),
    media: jsonb().$type<ReviewMedia[]>().notNull().default([]),
    isApproved: boolean().notNull().default(false),
    /** Shown first on the product page. */
    isPinned: boolean().notNull().default(false),
    /** "Verified buyer" badge. */
    isVerified: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.productId, t.userId),
    index().on(t.productId, t.isApproved),
    index().on(t.isApproved, t.createdAt),
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

/* ───────────── Admin notifications ───────────── */

/** order = new order · payment = UPI screenshot to verify · review = new/edited customer review · feedback = customer message. */
export const notificationType = pgEnum("notification_type", ["order", "payment", "review", "feedback"]);

/**
 * What the store needs to look at, newest first (Admin → Notifications).
 * Read state is shared by all admins (one small team). Rows older than
 * 90 days are pruned when new ones are written.
 */
export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: id(),
    type: notificationType().notNull(),
    title: text().notNull(),
    body: text(),
    /** Admin page to open, e.g. /admin/orders/<id>. */
    href: text().notNull(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.createdAt), index().on(t.readAt)],
).enableRLS();

/**
 * Admin devices that get phone/desktop notifications (web push). One row per
 * browser/installed app; the push service's endpoint URL identifies it. Rows
 * are removed when the push service says the subscription is gone.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    /** e.g. "iPhone · Safari", shown nowhere yet; helps when debugging. */
    device: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
).enableRLS();

/* ───────────── Customer feedback (chat with the store) ───────────── */

export const messageSender = pgEnum("message_sender", ["customer", "admin"]);

/**
 * One ongoing conversation per signed-in customer (like a WhatsApp chat
 * with the store). Read markers decide what's unread on each side.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastMessagePreview: text(),
    lastSender: messageSender(),
    customerReadAt: timestamp({ withTimezone: true }),
    adminReadAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.lastMessageAt)],
).enableRLS();

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sender: messageSender().notNull(),
    /** The admin who replied (null for customer messages, or if that admin was removed). */
    adminId: uuid().references(() => users.id, { onDelete: "set null" }),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.conversationId, t.createdAt)],
).enableRLS();

/**
 * Store traffic for the dashboard: one row per anonymous browser per day (India
 * time). `visitorId` is a random id the browser made up — no name, phone or IP.
 * Visitors in a period = distinct visitorIds; page views = sum of `views`.
 */
export const siteVisits = pgTable(
  "site_visits",
  {
    day: date().notNull(),
    visitorId: uuid().notNull(),
    /** "mobile" | "desktop" */
    device: text().notNull(),
    views: integer().notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.day, t.visitorId] })],
).enableRLS();

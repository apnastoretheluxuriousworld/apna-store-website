# Apna Store — Build Progress

We build one feature at a time: build → self-test → hand to the user to test → next.

| # | Feature | Status |
|---|---------|--------|
| F1 | Foundation & design shell | ✅ Done (approved 2026-11-07) |
| F2 | Infra: Supabase (Postgres) + Drizzle + R2 + Netlify | 🟡 Database live (migrated, seeded, RLS on); R2 credentials pending |
| F3 | Auth (phone + password) & admin shell | ✅ Done |
| F4 | Admin: categories + dynamic field builder | ✅ Done (approved 2026-11-08) |
| F5 | Admin: products (dynamic + per-product custom fields, images, variants) | 🟡 Built; blocked by the render-freeze bug below |
| F6 | Storefront: catalog, filters, product page, search | — |
| F7 | Homepage CMS: hero / reels / featured / testimonials (CRUD + drag) | — |
| F8 | Customer accounts + wishlist | 🟡 Accounts, order history + tracking, admin Customers built (2026-11-08); wishlist todo |
| F9 | Cart, coupons, checkout, Razorpay + COD rule | 🟡 Bag + checkout (UPI QR + screenshot, COD with consent) + admin Orders/verify built (2026-11-08); coupons + Razorpay todo |
| F10 | Admin: orders, status, settings, coupons, reviews, dashboard | — |
| F11 | Reviews + WhatsApp button | 🟡 Reviews moderation + testimonials admin built (2026-11-08); customer "write a review" waits for F8, WhatsApp button todo |
| F12 | PWA, SEO, policy pages, performance, launch | — |

## ▶ Resume here (handoff, 2026-11-08)
**Workflow (from the user):** build one feature at a time, then test it yourself and report with test steps. Wait for the user to test before starting the next feature. Discuss decisions in chat, not with popups. **Post a short progress update every few steps, and stop to ask when a bug takes more than ~20 minutes.**

**State**
- F1–F4 are done. F5 is built: offline tests pass, and the browser test passed 20/21 checks against the real DB before the freeze bug got in the way.
- R2 is still not configured (`S3_*` values in `.env` are placeholders), so product images can only be added by URL.

**✅ Resolved: DB-backed pages freezing.** Cause: postgres.js pipelined queries through Supabase's transaction pooler. Fixed by switching to `pg` (see `src/lib/db/index.ts`).

**How to verify (every feature)**
1. `npm run lint`, `npx tsc --noEmit`, `npm test` (now also `test:product`) and `npm run build`.
2. Start a production server against the real DB: `npx next start -p 3123`. **Never** touch the user's own dev server on :3000.
3. `npm run e2e` (warmup → auth → categories → products → store menu). The tests clean up leftovers from earlier crashed runs.
4. Look at the screenshots in `e2e/.output/`.
5. If dependencies changed, tell the user to restart `npm run dev`.

## F5: what's in it
- `/admin/products`: search (name/SKU), category and status filters, pagination (30 per page), thumbnail, price/compare-at, stock warnings, Featured star and Live switch.
- New and edit product pages:
  - name with auto slug, and a multi-line description
  - gallery: multi-upload, drag to reorder (first = cover), add by URL, max 12
  - the category's own fields, rendered by type and validated (required, number, dropdown option)
  - extra per-product details (name/value)
  - variants (label, SKU, optional price, stock); with variants, product stock = their sum
  - Draft/Live (Live needs an image), Featured
  - delete, which also removes now-unused uploaded files from R2
- Shared rules in `src/lib/validation/product.ts`, with `normalizeAttributes` used by both form and server. Actions in `src/app/admin/(panel)/products/actions.ts`, all calling `requireAdmin()`. Image keys are derived from URLs on the server, never trusted from the client.
- Planned storefront URL: `/product/<slug>` (F6).

## F1: what's in it
- Next.js 16.4 (App Router, Cache Components) with TypeScript, Tailwind v4, Motion and Lenis.
- Brand tokens are in `src/app/globals.css`: ink/gold/ivory colors, and the `text-gold`, `bg-gold`, `hairline`, `eyebrow` and `grain` utilities.
- Fonts: Cormorant Garamond (`font-serif`) and Montserrat (`font-sans`).
- Logo: transparent emblem, wordmark and full lockup in `public/brand/`, plus 192/512 icons for the PWA.
- Layout in `src/app/(store)/layout.tsx`:
  - Smooth scroll.
  - Page transitions through React `<ViewTransition>`.
  - Header that hides on scroll down and shows on scroll up.
  - Mobile bottom bar: Home, Shop, Wishlist, Bag, Account.
  - ☰ opens a full-screen menu that closes on navigation or Escape.
  - Small footer.
- Homepage in the section order the client wants, filled with **demo data** (`src/lib/demo.ts`):
  - hero
  - Our Feed (vertical 9:16 videos — formerly "film room"; now managed in Admin → Feed)
  - collections
  - best sellers
  - testimonials
- Placeholder pages for every link, all marked with the feature that will build them.
- 8 categories: Watches, Handbags, Shoes, Sunglasses, Wallets, Belts, Caps, Perfumes. Sunglasses, Belts and Caps were added on 2026-11-07, and they get seeded into the database in F2.
- Demo `/shop` (collection covers) and `/shop/[category]` (product grid) show the demo catalog until F6.

## F2: what's in it
- Schema: 19 tables in `src/lib/db/schema.ts`, with SQL migrations in `drizzle/`. Money is stored in **whole rupees** (integers); Razorpay amounts are rupees × 100.
- Product data:
  - Each category's fields are stored in `category_fields`.
  - A product stores its values for those fields in `products.attributes`.
  - Fields that apply to one product only go in `products.custom_attributes`.
- Seed (`src/lib/db/seed.ts`, safe to re-run):
  - 8 categories with 49 fields between them
  - the homepage section order
  - settings, including COD minimum ₹500
- Storage: `src/lib/storage/` uses R2 through the S3 API. It creates presigned direct uploads, checks file type and size, and stores files under paths like `folder/yyyy/mm/uuid.ext`.
- `/api/health` reports whether the database and storage connections work.
- **Supabase security:** RLS is enabled with no policies on every table (migration 0001). Supabase's public REST API (anon key) sees no rows, while the app's owner connection is unaffected. Every new table needs `.enableRLS()`, and `npm run test:db` fails if one is missing.
- Supabase is live since 2026-11-07 (region ap-northeast-1): 19 tables, 8 categories, 49 fields.
- Commands:
  - `npm run infra:check` checks the real credentials end to end.
  - `npm test` runs offline tests (in-memory Postgres and storage rules).
- Setup and deployment:
  - `SETUP.md` explains where to get each credential, how to deploy to Netlify, and how to move to the VPS.
  - `docker-compose.yml` runs Postgres locally or on the VPS.

## F3: what's in it
- Login works with a username (admins) or a phone number (customers, F8), plus a password of at least 4 characters. Passwords are hashed with scrypt (N=2^17).
- Sessions: a random token is kept in an httpOnly cookie for 30 days. The database stores only its SHA-256.
- Rate limit: 5 wrong passwords per account, or 20 per IP, within 15 minutes locks login for 15 minutes.
- `/admin` is protected in three places:
  - the proxy redirects visitors who have no session cookie
  - the layout checks the session
  - every page and action calls `requireAdmin()` itself
- Admin shell: a sidebar on desktop; on mobile, a top bar plus a bottom bar (Dashboard, Categories, Products, Orders, More).
- The dashboard shows live stats and a setup checklist. Each later admin section has a placeholder page.
- `npm run admin:create -- --username X --password Y` creates an admin, or resets an existing one and signs out its old sessions.
- The admin `apnastore` was created on 2026-11-07.

## F4: what's in it
- `/admin/categories`:
  - Drag to reorder; the store menu and header follow this order.
  - A switch per category controls whether it shows in the store.
  - Each row shows its thumbnail, slug, field count and product count.
- New and edit category pages:
  - Name, with an automatic slug.
  - Description, cover image (upload or URL) and visibility.
  - **Field builder**: label, automatic key, type (Text, Number, Dropdown, Yes/No), unit, dropdown options, required, show as shop filter, and drag to reorder.
  - Field keys lock after saving, because products store their values under the key.
- Delete needs a confirmation and is blocked while a category still has products.
- Validation rules are shared by the form and the server (`src/lib/validation/category.ts`). Every action calls `requireAdmin()`.
- **The storefront reads categories from the database.** This covers the header, menu, footer, home collections and `/shop` pages. It uses `getStoreCategories()` (`use cache` with the `categories` tag), which admin actions refresh with `updateTag`.
- Image upload: the image is resized to WebP of at most 1600px in the browser, then uploaded straight to R2 with a presigned URL. Until R2 is set up, the admin shows "Media storage isn't connected yet".

## Known notes
- **Next 16 + Cache Components rules learned in F4:**
  - `usePathname()` and dynamic `params` must be read inside `<Suspense>`. This applies to the store and admin navs and to `/shop/[category]`.
  - Cached functions must not fall back to `cacheLife("seconds")`, because it fails prerendering.
  - Next keeps previously visited pages mounted but hidden, so e2e tests must count only visible elements.
  - **Don't combine `generateStaticParams` with `updateTag`-invalidated data on dynamic routes** (Next 16.4.5 bug, React #412 on client nav). Read params inside `<Suspense>` and let Next cache each URL after its first visit. Keep this in mind for F6 product pages.
  - Correlated `sql` subqueries in Drizzle must name tables explicitly.
- **postgres.js is pinned to v3.4.7.** Version 4.1 hung pages: queries were left half-sent through Supabase's transaction pooler.
- With Partial Prefetching, anything that depends on the current time or a DB query must come after `connection()`. `getCurrentUser()` does this.
- `/shop/<unknown>` shows the 404 page but returns HTTP 200, because the page is streamed with Partial Prerendering. This goes away in F6, when categories come from the database.
- **Demo images:** `public/demo/<category>/` holds 29 DUMMY photos from the user's Downloads, covering all 8 categories. They are cropped to 4:5 WebP and used by the catalog import (`src/lib/demo.ts` was removed once the feed went live). Some show third-party brand logos, so they **must be replaced with the client's own photos before launch** (F12 checklist).

## Testimonials + reviews moderation (built 2026-11-08)
- **Homepage testimonials are managed in Admin → Testimonials** (`/admin/testimonials`, in the nav after Homepage). You can add, edit and delete them, drag to reorder (the homepage follows), and show or hide each one. A testimonial has a name, city, star rating, quote and optionally **one photo or video** (videos get an auto-captured poster frame; add by URL works too). It uses the existing `testimonials` table, so no migration was needed. The 3 old demo quotes were copied into the DB, and `demoTestimonials` was removed from `demo.ts`.
- Homepage section: `src/components/home/testimonials.tsx` (cached, tag `testimonials`; admin actions call `updateTag`). The section is hidden when there are none. Tapping a photo or video opens it full screen. Desktop uses masonry columns; mobile uses a swipe carousel.
- **Product reviews are written by customers on the storefront** (that comes with customer accounts, F8). The admin only moderates at `/admin/reviews`: Pending / Published / All tabs, search, rating and media filters, Publish switch, Pin, Delete, media viewer. There is no admin "Add review".
- Schema (migration 0003, applied): `reviews.user_id` is nullable, plus `author_name`, `city`, `media` jsonb `[{type, url, poster}]`, `is_pinned`, `is_verified`, `updated_at`.
- Storefront reviews block: `<ProductReviews productId=… />` (`src/components/reviews/product-reviews.tsx`) shows a rating summary and breakdown, client photos/videos, and the reviews (pinned first). **Render it on `/product/[slug]` when that page is built.** Card ratings count only published reviews (tag `reviews`).
- Shared pieces: `src/components/admin/media-upload.tsx` (photo/video picker), `src/components/reviews/media-viewer.tsx` (thumbnails + full-screen viewer), `src/components/admin/star-picker.tsx`. Upload folder `reviews/`; `cleanup.ts` also checks review media.
- Still to do: the customer "write a review" form (F8: photos/videos, saved as Pending, `is_verified` from orders) and the WhatsApp button.
- e2e: `e2e/testimonials.mjs` (15 checks), `e2e/reviews.mjs` (20 checks). The reviews storefront-block checks need a throwaway `/e2e-reviews/[id]` route rendering `<ProductReviews>`; both need `public/e2e/clip.mp4` in the clone (the checks skip without them).

## Our Feed — vertical videos (built 2026-11-08)
- **"The Film Room" is now "Our Feed"**: vertical **9:16 videos only**, like YouTube Shorts. Managed in **Admin → Feed** (`/admin/feed`, in the nav after Homepage). It uses the existing `reels` table (`title` holds the optional caption). Migration 0004 (applied) renames the homepage section title; the seed says "Our Feed" too. `demoReels` and `src/lib/demo.ts` are gone.
- Admin: a grid of 9:16 tiles. **Add videos** takes several files at once (or drag them onto the grid); each one uploads straight to R2 (`reels/` folder) with an auto-captured poster frame and becomes a post right away. Drag to reorder, switch to show/hide, and tap a tile to edit the caption, replace the video or delete it. Saves and deletes go through the outbox, so they feel instant.
- Upload rules: MP4, WebM or MOV up to 200 MB. **Landscape or square videos are rejected**, and a vertical video that isn't exactly 9:16 gets a "will be cropped slightly" warning. If the browser can't read the video's size (some HEVC .mov files on desktop Chrome), it's accepted without the check.
- Storefront: `src/components/home/feed.tsx` (cached, tag `feed`; hidden when there are no videos) → horizontal strip of 9:16 cards. Tapping a card (or "Watch all") opens `feed-viewer.tsx`, a full-screen vertical swipe player: one video per screen, it plays and loops while visible, sound on (falls back to muted if the browser blocks it), mute button, tap to pause, progress bar, ↑/↓ keys and buttons on desktop. **The phone's back button closes the player.** Only the visible video and its neighbours load.
- **Bulk import:** `npm run feed:import -- <folder>` converts each video to a web-ready MP4 (H.264, 1080×1920, 30 fps, ≤5 Mbps, centre-cropped to 9:16), uses the first frame as a WebP thumbnail, uploads both to R2 `reels/` and puts them at the front of the feed in file-name order. It needs ffmpeg. On 2026-11-08 the client's reel1–reel5 were imported this way (iPhone HEVC .MOV, 23–121 MB, came out at 9–34 MB; reel1 was landscape and was centre-cropped).
- Not done: `reels.product_id` ("shop this look") is unused until product pages (`/product/[slug]`) exist.
- e2e: `e2e/feed.mjs` (27 checks: upload, landscape rejection, caption, player on desktop and mobile, back button, hide, delete incl. storage cleanup). It needs `E2E_VERTICAL` and `E2E_LANDSCAPE` set to **WebM** clips (Playwright's Chromium can't decode H.264) and launches Chromium with `--disable-web-security`, because the R2 CORS policy doesn't list :3123.

## Customer accounts (built 2026-11-08)
- **Sign up** at `/account/signup`: full name, mobile (Indian 10-digit, unique; "+91 98765 43210" etc. accepted, stored as 10 digits) and a **4-digit PIN** (+ confirm). **Sign in** at `/account/login`: mobile + PIN. Rules shared in `src/lib/validation/customer.ts`; auth in `src/lib/auth/core.ts` (`registerCustomer`, `changePassword`, `resetPassword`, `deleteUserSessions`).
- **Security:** PINs are scrypt-hashed like admin passwords. Limits: 5 wrong PINs per account per 15 min, **15 per account per day** (a 4-digit PIN has only 10,000 options), 60 per IP per 15 min (loose on purpose: Indian carriers share IPs via CGNAT), 10 new accounts per IP per hour. Blocked accounts can't sign in and have no valid session. `?next=` only allows same-site paths.
- **No OTP** (cost/DLT decision pending with the client). "Forgot PIN" → Contact; the store resets the PIN in Admin → Customers.
- **Account pages** (`/account`, `/account/orders/[orderNumber]`, `/account/profile`): greeting + stats, order history, order detail with a step tracker (placed → confirmed → packed → shipped → delivered, or cancelled) built from `order_status_history`, store notes, courier + tracking no. + "Track shipment" link, items, totals, address, payment. Profile: change name, change PIN (signs out other devices). The proxy sends signed-out visitors to sign-in.
- **Admin → Customers** (`/admin/customers`): stats, search by name/mobile, sort (newest, top spenders, most orders, recently active), blocked filter. Customer page: orders, spend (cancelled excluded), avg order, last sign-in, signed-in devices, addresses (saved + used on orders), reviews/wishlist counts, Call/WhatsApp, and manage: name, private note, block (signs out at once), reset PIN, delete (orders kept as guest orders).
- **Admin order page** `/admin/orders/[id]` (reached from a customer): change status with an optional note for the customer (COD → Delivered also marks Paid), courier/tracking number/link, history. The Orders list page itself is still the F10 placeholder.
- Schema (migration 0006, applied): `users.is_blocked`, `last_login_at`, `admin_note`; `orders.courier_name`, `tracking_number`, `tracking_url`.
- **Speed:** account pages are private-cached in the browser (`requireCustomerView`, cacheLife profile `account`, 5 min) and prefetched, so tab switches take ~50–100 ms with no skeleton; sign in/out/up and profile saves wipe that cache (`revalidatePath("/account", "layout")`). Tab links carry `transitionTypes={["tab"]}` so the store's page fade is skipped for them. My Orders loads in 2 DB round trips (session incl. `createdAt`, orders with item summary in one query). In `next dev` there's no prefetching, so tabs there always fetch.
- e2e: `e2e/customers.mjs` (incl. tab-switch speed and "next person on the same browser sees only their own account"; sign-up/in rules, lockout, history isolation, tracking, PIN change/reset, block, delete, admin status/tracking). It seeds orders `E2E-*` for phones `6999…` and clears the localhost rate-limit counters.
- Known: a revoked session (PIN reset/block) is detected while the page streams; the redirect to sign-in cancels the page's view transition and Chromium logs a harmless "Transition was skipped". `e2e/admin-cache.mjs` is stale (looks for `/shop/<slug>` text no longer on the Categories list).
- Still to do in F8: wishlist, saved addresses (checkout F9 should save them), customer "write a review".

## Bag + checkout (built 2026-11-08)
- **Bag** lives in the browser (`src/components/cart/cart-store.ts`, localStorage `apna-bag-v1`, synced across tabs): only ids + qty; names/prices/stock always come from the server (`quoteCart` → `priceCart` in `src/lib/data/checkout.ts`). Max 10 per line, 30 lines. "Add to bag" on product cards (`add-to-bag.tsx`); products with variants open an option picker (no live product has variants yet, so the picker is untested in e2e). Badge on header + bottom bar. `/cart`: qty stepper capped by stock, remove, sold-out / "only N left" flags block checkout.
- **Checkout** `/checkout` (guests allowed; signed-in customers get name/phone/last address pre-filled and the address saved to `addresses`). Payment:
  - **UPI**: shows the QR image the admin uploads (Settings → Payments & delivery), the exact amount, optional UPI ID (copy + "Open UPI app" deep link on touch devices). Customer uploads a screenshot (presigned to R2 `payments/`, 30/hr per IP) + optional UTR. Order: `payment_method=upi`, `payment_status=pending`.
  - **COD**: consent checkbox → `cod_consent_at`; blocked below the COD minimum or when COD is off.
- `placeOrder` (`src/app/(store)/checkout/actions.ts`): validates, re-prices with row locks (`for update`), reserves stock (products + variants), order number `AS-######`, private `access_token`, history "placed". 20 orders/hr per IP. Cancelling an order returns stock (un-cancelling takes it again).
- **Order page by private link** `/order/<token>` (checkout lands on `?placed=1`): tracker, payment notice (verifying / received / rejected + re-upload). Shared `OrderView` (`src/components/account/order-view.tsx`) is also used by My Orders.
- **Admin**: `/admin/orders` list with tabs (Verify payment, New, In progress, Delivered, Cancelled, All) + search (order no, name, mobile, UTR). Order page: screenshot (tap to enlarge), UTR, **Approve** (→ Paid + Confirmed, "Payment received" note) / **Reject** with reason (customer sees it and re-uploads). Dashboard shows "N payments to verify". Settings → Payments & delivery: QR, UPI ID, payee name, COD on/off + minimum, shipping fee, free-shipping threshold (settings key `payments`; falls back to the old seeded keys).
- Schema (migration 0007, applied): `payment_method` + `upi`; `orders.access_token` (unique), `payment_proof_url`, `payment_reference`, `payment_note`, `payment_verified_at`, `cod_consent_at`.
- e2e: `e2e/checkout.mjs` (43 checks, phones `69996…`): restores stock, the `payments` setting and deletes test screenshots from R2; clears `order:::1` / `proof:::1` rate-limit counters. Needs `--disable-web-security` (R2 CORS) — already in the script.
- **Charges** (Settings → Payments & delivery, 2026-11-08): **COD charge** (flat ₹, added to the total only when COD is picked; the COD minimum is checked before it) and **return charge** (flat ₹, shown at checkout + on the order, not added to the total). No UPI charge (user's decision). Migration 0008: `orders.cod_fee` (int, default 0), `orders.return_fee` (nullable). `computeTotals(subtotal, settings, method)`.
- Product page + cards: "Add to bag" turns into "Remove from bag" once that piece is in the bag (toast with Undo).
- Not done: coupons, Razorpay, order notifications (WhatsApp/SMS to the store on a new order).

## Security hardening (2026-11-09)
- **Admin password rotated** (the old 6-digit one was in the public GitHub history). Admin passwords must be 12+ characters and not easy to guess (`scripts/create-admin.mts`). The real one lives only in `.env` (`E2E_PASS`) and the owner's password manager. Never put it in tests or docs.
- **Sign-in limits** (`src/lib/auth/core.ts`) are counted atomically *before* the password/PIN check (`hit()`), so parallel requests can't slip past:
  - customers (4-digit PIN): 5 per account per 15 min, 15 per account per day, 20 failed per network per 15 min, 100 per network per day;
  - admin: 5 per username *per network* per 15 min (nobody can lock the admin out from elsewhere), 20 per network;
  - sign-up: 15 attempts per network per hour; change PIN: 5 per 15 min.
- **Separate login scopes:** the customer form only matches customers by phone, the admin form only matches admins by username. (Before, the admin form told you when a customer's PIN was right.)
- **Hashing cap** (`src/lib/auth/password.ts`): max 2 scrypt hashes at once per instance, 24 queued, the rest get "try again in a moment" (each hash is 128 MiB).
- **Trusted client IP** (`src/lib/auth/request.ts`): Vercel `x-real-ip`, Netlify `x-nf-client-connection-ip`, otherwise `CLIENT_IP_HEADER` (set it on the VPS behind nginx). Never the visitor-supplied `x-forwarded-for` in production.
- **Forgot PIN** answers the same for unknown numbers. Profile actions refuse non-customer sessions.
- **Checkout:** 10 orders per network per hour, max 3 unconfirmed orders per phone/account, 10 screenshot uploads per network per hour. Review uploads need a shipped/delivered order.
- **Headers** (`next.config.ts`): HSTS, frame-ancestors 'none' / X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, no X-Powered-By; `noindex` on /admin, /account, /order. Images only from the exact `S3_PUBLIC_URL` host.
- **Admin sessions** last 7 days (customers 30).
- `/api/health` returns a bare "ok" unless `x-health-token: $HEALTH_TOKEN` is sent.
- Still open: make the GitHub repo private; Turnstile on sign-in/sign-up; Supabase private channels for realtime; DB TLS certificate verification; restore tests to git + CI.


## Combo offers (built 2026-11-09)
- **Admin → Offers** (`/admin/offers`): cover image (AI-made, 4:5; uploads to R2 `offers/`), title, optional description, "customer picks N for ₹P", products chosen from the store (searchable picker, kept in pick order), on/off switch, optional start/end dates (India time). Saves are instant through the outbox (`offer.save` / `offer.delete`). The page address `/offers/<slug>` is made from the title once and then kept. The list shows status, products not live, and bundles sold.
- **Storefront:** no homepage section (user's decision, 2026-11-12). All live offers are on their own page `/offers` (`src/app/(store)/offers/page.tsx`); hero banners link to it through the button choice "All offers" (or "Offer: <title>" for one offer) in Admin → Hero banners. Each offer has its own page (`/offers/[slug]`, `src/components/offers/offer-picker.tsx`): the customer picks N of its products (the same one more than once is OK if stock allows; products with options open the option sheet) and adds the set to the cart as **one line** at the offer price. If an offer's product count equals N, it's a fixed combo (pre-picked when no options are needed).
- **Rules:** the offer price applies only through the offer page, and the same products added normally cost full price. Coupons never apply to offer items: they work on the regular items in the same cart, a cart with only offers shows "Coupons don't apply to offers", and influencer commission is on the regular items only.
- **Bag:** bundles live in localStorage `apna-offers-v1` (`{ id, offerId, picks[] }`, max 10). `priceBag()` in `src/lib/data/checkout.ts` prices product lines and bundles from the same locked rows, checks stock across both, and refuses ended/off offers, wrong pick counts and products not in the offer.
- **Orders:** each offer item becomes its own `order_items` row with `offer_id`, `offer_title`, `bundle_no` and `unit_price` = its share of the offer price (`allocateBundle`: proportional to normal prices, whole rupees that add up exactly). This share is what a partial refund would use. Admin and customer order pages tag these items "Offer: …".
- Schema: migration 0014 (applied): `offers`, `offer_products` (cascade on product delete), `order_items.offer_id/offer_title/bundle_no`.
- e2e: `e2e/offers.mjs` (41 checks, phones `69992…`; sets 4 products' stock to 5 for the run and restores it). Also fixed the stale `e2e/checkout.mjs` ("Add to cart" wording, settings-save race).
- Open with the client: the return rule for offer items (I suggest refunding the item's share of the offer price) still needs to go in the refund policy.

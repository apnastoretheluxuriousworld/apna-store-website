# Apna Store — Build Progress

We build one feature at a time: build → self-test → hand to the user to test → next.

| # | Feature | Status |
|---|---------|--------|
| F1 | Foundation & design shell | ✅ Done (approved 2026-11-07) |
| F2 | Infra: Supabase (Postgres) + Drizzle + R2 + Netlify | 🟡 Database live (migrated, seeded, RLS on); R2 credentials pending |
| F3 | Auth (phone + password) & admin shell | ✅ Done |
| F4 | Admin: categories + dynamic field builder | ✅ Built, waiting for user testing |
| F5 | Admin: products (dynamic + per-product custom fields, images, variants) | — |
| F6 | Storefront: catalog, filters, product page, search | — |
| F7 | Homepage CMS: hero / reels / featured / testimonials (CRUD + drag) | — |
| F8 | Customer accounts + wishlist | — |
| F9 | Cart, coupons, checkout, Razorpay + COD rule | — |
| F10 | Admin: orders, status, settings, coupons, reviews, dashboard | — |
| F11 | Reviews + WhatsApp button | — |
| F12 | PWA, SEO, policy pages, performance, launch | — |

## ▶ Resume here (handoff, 2026-11-07)
**Workflow (from the user):** build one feature at a time, then test it yourself and report with test steps. Wait for the user to test before starting the next feature. Discuss decisions in chat, not with popups.

**State**
- F1–F4 are built. F4 is waiting for the user to test it.
- **R2 is not configured yet:** the `S3_*` values in `.env` are still placeholders.
- Supabase is live: 8 categories, 49 fields, admin `apnastore`.

**Next:** F5, admin products (see the plan in `~/.claude/plans/go-with-cormorant-lively-teapot.md`). Image uploads need R2; `ImageUpload` and `getUploadUrl` are already built.

**How to verify (every feature)**
1. `npm run lint`, `npx tsc --noEmit`, `npm test` (offline: in-memory Postgres, storage rules, auth) and `npm run build`.
2. Start a production server against the real DB: `npx next start -p 3123`. **Never** touch the user's own dev server on :3000.
3. Run the browser tests: `npm run e2e`. They use the real Supabase DB and clean up after themselves. Credentials come from `E2E_USER` / `E2E_PASS` in `.env`.
4. Look at the screenshots in `e2e/.output/` for wrong data, not just pass/fail.
5. If dependencies changed, tell the user to restart `npm run dev`.

**Fixed 2026-11-07: "flaky" store menu.** This was a real bug, not a flaky test. After any admin category save (`updateTag("categories")`), a client navigation to a pre-built `/shop/<category>` got a partial App Shell stream. React threw #412 (Flight "Connection closed") and the page showed "This page couldn't load". It only failed in `npm run e2e` because `categories.mjs` runs first and does the invalidating. The fix was removing `generateStaticParams` from `/shop/[category]`. `store-menu.mjs` now asserts the heading renders and exits non-zero on failure.

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
  - film room (reels)
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
- **Demo images:** `public/demo/<category>/` holds 29 DUMMY photos from the user's Downloads, covering all 8 categories. They are cropped to 4:5 WebP and mapped in `src/lib/demo.ts`. Some show third-party brand logos, so they **must be replaced with the client's own photos before launch** (F12 checklist).

// Run against a production build: npm run build && npx next start -p 3123, then `node e2e/categories.mjs`.
// Uses the real Supabase DB; tests clean up after themselves. Admin creds: E2E_USER / E2E_PASS.
import { mkdirSync } from "node:fs";
try { process.loadEnvFile(".env"); } catch {}
if (!process.env.E2E_USER || !process.env.E2E_PASS) { console.error("Set E2E_USER and E2E_PASS in .env"); process.exit(1); }
import { chromium } from "playwright";
const out = process.env.E2E_OUT ?? "e2e/.output"; const base = process.env.E2E_BASE ?? "http://localhost:3123";
mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const errors = [];
const log = (ok, m) => console.log(`  ${ok ? "✓" : "✗"} ${m}`);
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", e => errors.push(String(e)));
const store = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const storeText = async (path) => { await store.goto(base + path, { waitUntil: "networkidle" }); return store.locator("body").innerText(); };
const toast = (t) => p.locator("[data-sonner-toast]").filter({ hasText: t }).first().waitFor({ timeout: 15000 });

// login
await p.goto(base + "/admin/login");
await p.fill('input[name="identifier"]', process.env.E2E_USER); await p.fill('input[name="password"]', process.env.E2E_PASS);
await p.click('button[type="submit"]'); await p.waitForURL(base + "/admin", { timeout: 20000 });

// 1. list
await p.goto(base + "/admin/categories"); await p.getByText("/shop/watches").waitFor();
const rowCount = await p.locator("ul li").filter({ hasText: "/shop/", visible: true }).count();
log(rowCount === 8, `list shows ${rowCount} categories with field/product counts`);
await p.screenshot({ path: `${out}/c-list.png` });

// 2. edit Watches: description + new field
await p.getByRole("link", { name: /Watches/ }).first().click();
await p.waitForURL(/\/admin\/categories\/[0-9a-f-]{36}$/); const watchesUrl = p.url();
await p.locator("#description").waitFor();
const origDesc = await p.locator("#description").inputValue();
const lockedKeys = await p.locator('input[aria-label="Field key"][readonly]').count();
log(lockedKeys === 8, `existing 8 field keys are locked (read-only)`);
await p.locator("#description").fill("Swiss & Japanese timepieces");
await p.getByRole("button", { name: "Add field" }).click();
const labels = p.locator('input[aria-label="Field label"]');
await labels.last().fill("Bracelet Length");
const newKey = await p.locator('input[aria-label="Field key"]').last().inputValue();
log(newKey === "bracelet_length", `key auto-generated from label → "${newKey}"`);
await p.locator('select[aria-label="Field type"]').last().selectOption("number");
await p.locator('input[aria-label="Unit"]').last().fill("cm");
await p.screenshot({ path: `${out}/c-edit.png`, fullPage: true });
await p.getByRole("button", { name: "Save changes" }).click(); await toast("Category saved");
await p.reload(); await p.locator("#description").waitFor();
const saved = (await p.locator("#description").inputValue()) === "Swiss & Japanese timepieces" &&
  (await p.locator('input[aria-label="Field label"]').last().inputValue()) === "Bracelet Length" &&
  (await p.locator('input[aria-label="Field key"]').last().getAttribute("readonly")) !== null;
log(saved, "saved: description + new field persist after reload; new key now locked");

// 3. validation: dropdown without options
await p.goto(base + "/admin/categories/new"); await p.locator("#name").waitFor();
await p.locator("#name").fill("Jewellery");
const slug = await p.locator("#slug").inputValue();
log(slug === "jewellery", `slug auto-generated → "${slug}"`);
await p.getByRole("button", { name: "Add field" }).click();
await p.locator('input[aria-label="Field label"]').last().fill("Metal");
await p.locator('select[aria-label="Field type"]').last().selectOption("select");
await p.getByRole("button", { name: "Create category" }).click();
await p.getByText("Add at least 2 options").waitFor({ timeout: 8000 });
log(true, "dropdown with no options → 'Add at least 2 options' shown, not saved");
await p.locator('input[aria-label="Dropdown options"]').fill("Gold, Silver, Platinum");
await p.locator('input[aria-label="Field label"]').first().fill("Brand");

// 4. image upload without R2 → clear message
const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Upload" }).click()]);
await chooser.setFiles("public/demo/caps/crystal-crest-cap.webp");
await p.getByText("Media storage isn't connected yet").waitFor({ timeout: 15000 });
log(true, "upload without R2 → 'Media storage isn't connected yet' message");

await p.getByRole("button", { name: "Create category" }).click();
await p.waitForURL(/\/admin\/categories\/[0-9a-f-]{36}$/, { timeout: 15000 }); const jewelUrl = p.url();
log(true, "Jewellery created → redirected to its edit page");

// storefront picks it up
let t = await storeText("/shop");
log(t.includes("Jewellery"), "store /shop shows the new Jewellery collection");
t = await storeText("/shop/jewellery");
log(t.includes("New pieces arriving soon"), "store /shop/jewellery renders (empty-state)");

// 5. reorder with keyboard: move Jewellery (last) to top
await p.goto(base + "/admin/categories"); await p.getByText("/shop/jewellery").waitFor();
const handle = p.getByRole("button", { name: "Drag to reorder Jewellery" });
await handle.focus(); await p.keyboard.press("Space");
for (let i = 0; i < 9; i++) { await p.keyboard.press("ArrowUp"); await p.waitForTimeout(80); }
await p.keyboard.press("Space"); await toast("Order saved");
const firstNav = await (async () => { await store.goto(base + "/", { waitUntil: "networkidle" }); return store.locator('nav[aria-label="Collections"] a').first().innerText(); })();
log(/jewellery/i.test(firstNav), `store header's first collection is now "${firstNav}"`);

// 6. hide
await p.getByRole("switch", { name: "Show Jewellery in store" }).click(); await toast("Hidden from store");
t = await storeText("/shop");
log(!t.includes("Jewellery"), "hidden → Jewellery disappears from store /shop");

// 7. delete
await p.goto(jewelUrl); await p.getByRole("button", { name: "Delete", exact: true }).click();
await p.locator("dialog").getByRole("button", { name: "Delete" }).click();
await p.waitForURL(base + "/admin/categories", { timeout: 15000 });
// Next 16 keeps the previous page mounted (hidden) — only count visible rows.
await p.getByText("/shop/watches").filter({ visible: true }).waitFor();
const gone = (await p.getByText("/shop/jewellery").filter({ visible: true }).count()) === 0;
log(gone, "Jewellery deleted (confirm dialog) and removed from list");

// mobile screenshot of the edit form
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await ctx.storageState() })).newPage();
await m.goto(watchesUrl); await m.locator("#description").waitFor(); await m.waitForTimeout(600);
await m.screenshot({ path: `${out}/c-edit-m.png` });

// 8. revert Watches
await p.goto(watchesUrl); await p.locator("#description").waitFor();
await p.locator("#description").fill(origDesc);
await p.getByRole("button", { name: "Remove field" }).last().click();
await p.getByRole("button", { name: "Save changes" }).click(); await toast("Category saved");
await p.reload(); await p.locator("#description").waitFor();
const reverted = (await p.locator('input[aria-label="Field label"]').count()) === 8 && (await p.locator("#description").inputValue()) === origDesc;
log(reverted, "Watches reverted (test field removed, description restored)");

// Restore original order (Watches first) by moving nothing — Jewellery deletion leaves original relative order.
console.log("errors:", errors);
await b.close();

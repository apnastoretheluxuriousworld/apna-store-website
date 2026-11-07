// Run against a production build: npm run build && npx next start -p 3123, then `node e2e/store-menu.mjs`.
// Uses the real Supabase DB; tests clean up after themselves. Admin creds: E2E_USER / E2E_PASS.
import { mkdirSync } from "node:fs";
try { process.loadEnvFile(".env"); } catch {}
if (!process.env.E2E_USER || !process.env.E2E_PASS) { console.error("Set E2E_USER and E2E_PASS in .env"); process.exit(1); }
import { chromium } from "playwright";
const out = process.env.E2E_OUT ?? "e2e/.output"; const base = process.env.E2E_BASE ?? "http://localhost:3123";
mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const errors = [];
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
m.on("pageerror", e => errors.push(String(e))); m.on("console", x => x.type() === "error" && errors.push(x.text()));
await m.goto(base + "/shop/handbags", { waitUntil: "networkidle" }); await m.waitForTimeout(1200);
await m.screenshot({ path: `${out}/n-m-top.png` });
await m.getByRole("button", { name: "Open menu" }).click(); await m.waitForTimeout(1000);
await m.screenshot({ path: `${out}/n-m-menu.png` });
await m.getByRole("button", { name: "Close menu" }).first().click(); await m.waitForTimeout(800);
console.log("closed via bar:", await m.locator("#site-menu").count() === 0);
await m.getByRole("button", { name: "Open menu" }).click(); await m.waitForTimeout(800);
await m.mouse.click(195, 60); await m.waitForTimeout(800);
console.log("closed via backdrop:", await m.locator("#site-menu").count() === 0);
await m.getByRole("button", { name: "Open menu" }).click(); await m.waitForTimeout(800);
await m.locator("#site-menu").getByRole("link", { name: "Perfumes", exact: true }).click(); await m.waitForTimeout(1200);
const navOk = m.url().endsWith("/shop/perfumes"); const menuClosed = await m.locator("#site-menu").count() === 0;
const heading = await m.locator("h1:visible").allTextContents();
console.log("nav:", m.url(), "closed:", menuClosed, "h1:", heading);
const d = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await d.goto(base + "/", { waitUntil: "networkidle" }); await d.waitForTimeout(1200);
await d.getByRole("button", { name: "Open menu" }).click(); await d.waitForTimeout(900);
await d.screenshot({ path: `${out}/n-d-menu.png` });
console.log("errors:", errors); await b.close();
if (!navOk || !menuClosed || !heading.includes("Perfumes") || errors.length) { console.error("✗ store-menu failed"); process.exit(1); }
console.log("✓ store-menu passed");

// Run against a production build: npm run build && npx next start -p 3123, then `node e2e/admin-auth.mjs`.
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

await p.goto(base + "/admin/categories");
log(p.url().startsWith(base + "/admin/login?next=%2Fadmin%2Fcategories"), `signed-out /admin/categories → ${p.url().replace(base, "")}`);
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/a-login.png` });

await p.fill('input[name="identifier"]', process.env.E2E_USER);
await p.fill('input[name="password"]', "wrongpass");
await p.click('button[type="submit"]');
await p.getByText("Incorrect username/phone or password.").waitFor({ timeout: 15000 });
log(true, "wrong password → generic error shown, still on login");

await p.fill('input[name="password"]', process.env.E2E_PASS);
await p.click('button[type="submit"]');
await p.waitForURL(base + "/admin/categories", { timeout: 20000 });
log(true, "correct login → returned to the page originally requested (/admin/categories)");

await p.goto(base + "/admin"); await p.getByText("Welcome, Apna").filter({ visible: true }).waitFor({ timeout: 15000 });
await p.waitForTimeout(800);
const cats = await p.locator("text=Categories").first().isVisible();
log(cats, "dashboard renders with live stats");
await p.screenshot({ path: `${out}/a-dash.png` });

const cookie = (await ctx.cookies()).find(c => c.name === "apna_session");
log(cookie?.httpOnly && cookie.sameSite === "Lax", `session cookie httpOnly=${cookie?.httpOnly} sameSite=${cookie?.sameSite}`);

// Visiting login while signed in bounces to dashboard
await p.goto(base + "/admin/login"); await p.waitForURL(base + "/admin", { timeout: 15000 });
log(true, "signed-in visit to /admin/login → redirected to /admin");

// Mobile view
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await ctx.storageState() })).newPage();
await m.goto(base + "/admin"); await m.getByText("Welcome, Apna").waitFor({ timeout: 15000 }); await m.waitForTimeout(800);
await m.screenshot({ path: `${out}/a-dash-m.png` });
await m.getByRole("button", { name: "More" }).click(); await m.waitForTimeout(700);
await m.screenshot({ path: `${out}/a-more-m.png` });
log(true, "mobile dashboard + More sheet rendered");

// Forged cookie passes the proxy but not requireAdmin
const f = await b.newContext(); await f.addCookies([{ name: "apna_session", value: "forged", url: base }]);
const fp = await f.newPage(); await fp.goto(base + "/admin/orders"); await fp.waitForTimeout(3000);
log(fp.url().startsWith(base + "/admin/login"), `forged cookie → ${fp.url().replace(base, "")}`);
const forgedLeak = await fp.locator("text=Track and fulfil").count();
log(forgedLeak === 0, "no admin content shown to forged session");

// Sign out
await p.goto(base + "/admin"); await p.getByText("Welcome, Apna").waitFor();
await p.getByRole("button", { name: "Sign out" }).first().click();
await p.waitForURL(/\/admin\/login/, { timeout: 15000 });
await p.goto(base + "/admin"); await p.waitForTimeout(1500);
log(p.url().startsWith(base + "/admin/login"), "after sign out, /admin → login again");

console.log("errors:", errors);
await b.close();

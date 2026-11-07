// Shared helpers for CLI scripts (run with tsx, outside Next.js).
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file — use the real environment */
}

export function need(name: string): string {
  const v = process.env[name];
  if (!v) fail(`${name} is not set (see .env.example)`);
  if (v.includes("YOUR_") || v.includes("XXXXXXXX")) fail(`${name} still has the placeholder value — paste the real one in .env`);
  return v;
}

export function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

export const ok = (msg: string) => console.log(`  ✓ ${msg}`);

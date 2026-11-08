/**
 * Password hashing with Node's built-in scrypt (no native add-ons, so it runs
 * the same on Netlify and on a VPS). Parameters follow OWASP guidance:
 * N=2^17, r=8, p=1. Stored as: scrypt$<log2N>$<r>$<p>$<salt b64>$<hash b64>
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const LOG_N = 17;
const R = 8;
const P = 1;
const KEY_LEN = 64;

/**
 * Each hash takes 128 MiB of memory and one of Node's 4 libuv threads for
 * ~100–300 ms. Without a cap, a burst of sign-in requests (even with wrong
 * PINs) would exhaust memory and stall everything else that uses those
 * threads (DNS for DB connects, file and crypto work). So at most
 * MAX_ACTIVE hashes run at once per server instance; a short queue waits, and
 * beyond that requests are turned away with HashBusy.
 */
const MAX_ACTIVE = 2;
const MAX_WAITING = 24;
let active = 0;
const waiting: (() => void)[] = [];

/** Too many sign-ins at this moment; the caller shows "try again in a moment". */
export class HashBusy extends Error {
  constructor() {
    super("Password hashing is busy");
  }
}

async function withHashSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_ACTIVE) {
    if (waiting.length >= MAX_WAITING) throw new HashBusy();
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return withHashSlot(
    () =>
      new Promise<Buffer>((resolve, reject) =>
        scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
      ),
  );
}

const opts = (logN: number, r: number, p: number): ScryptOptions => ({
  N: 2 ** logN,
  r,
  p,
  maxmem: 256 * 1024 * 1024,
});

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, opts(LOG_N, R, P));
  return ["scrypt", LOG_N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, logN, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(
    password.normalize("NFKC"),
    Buffer.from(saltB64, "base64"),
    expected.length,
    opts(Number(logN), Number(r), Number(p)),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash used to keep "unknown user" logins as slow as real ones. */
export const DUMMY_HASH =
  "scrypt$17$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(KEY_LEN).toString("base64");

/** Customers sign in with a 4-digit PIN (validation/customer.ts). */
export const PASSWORD_MIN_LENGTH = 4;

/**
 * Admin passwords: the admin account can see every customer's name, phone and
 * address, so it gets a real password. Enforced when one is set (create-admin).
 */
export const ADMIN_PASSWORD_MIN_LENGTH = 12;

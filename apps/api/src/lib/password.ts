/**
 * PBKDF2-SHA256 password hashing, usable inside a Cloudflare Worker (no
 * Node-only deps). Hash format: `v1$<iters>$<saltB64>$<hashB64>`.
 */

// Cloudflare Workers caps PBKDF2 iterations at 100_000; going higher throws
// `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
// supported`. 100k is still within OWASP's recommended range for PBKDF2-SHA256
// and is what we store in the hash string so verify can read it back.
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const enc = new TextEncoder();

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const byte of arr) bin += String.fromCharCode(byte);
  return btoa(bin);
}

function fromBase64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `v1$${String(ITERATIONS)}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const [, itersStr, saltB64, hashB64] = parts as [string, string, string, string];
  const iters = Number.parseInt(itersStr, 10);
  if (!Number.isFinite(iters) || iters < 1000) return false;
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const actual = await pbkdf2(password, salt, iters);
  return timingSafeEqual(expected, actual);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

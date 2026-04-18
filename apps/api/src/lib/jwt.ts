/**
 * Minimal HS256 JWT implementation. Intentionally small so we don't ship a
 * full jose bundle into every Worker invocation.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface AdminJwtPayload {
  sub: string; // admin id
  iat: number; // unix seconds
  exp: number; // unix seconds
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const byte of arr) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64Url(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replaceAll('-', '+').replaceAll('_', '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signAdminJwt(payload: AdminJwtPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = toBase64Url(enc.encode(JSON.stringify(header)));
  const p = toBase64Url(enc.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${toBase64Url(sig)}`;
}

export async function verifyAdminJwt(
  token: string,
  secret: string,
): Promise<AdminJwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  const key = await importKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, fromBase64Url(s), enc.encode(`${h}.${p}`));
  if (!ok) return null;
  try {
    const parsed = JSON.parse(dec.decode(fromBase64Url(p))) as AdminJwtPayload;
    if (typeof parsed.sub !== 'string') return null;
    if (typeof parsed.exp !== 'number' || parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

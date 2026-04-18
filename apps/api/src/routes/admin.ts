import { Hono } from 'hono';
import { z } from 'zod';
import { getCookie, setCookie } from 'hono/cookie';
import { challengeDateSchema, type DailyChallenge, dailyChallengeSchema } from '@linkle/shared';
import type { Env } from '../env.js';
import { verifyPassword } from '../lib/password.js';
import { signAdminJwt, verifyAdminJwt } from '../lib/jwt.js';
import { deleteChallenge, listChallenges, upsertChallenge } from '../db/challenges.js';

const COOKIE_NAME = 'linkle_admin';
const SESSION_TTL_SEC = 60 * 60 * 12; // 12h

const loginSchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

interface AdminRow {
  id: string;
  username: string;
  password_hash: string;
}

interface AdminVariables {
  adminId: string;
}

export const adminRoute = new Hono<{ Bindings: Env; Variables: AdminVariables }>();

adminRoute.post('/login', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad-credentials' }, 400);
  const { username, password } = parsed.data;

  const row = await c.env.DB.prepare(
    'SELECT id, username, password_hash FROM admins WHERE username = ?1',
  )
    .bind(username)
    .first<AdminRow>();
  if (!row) return c.json({ error: 'bad-credentials' }, 401);

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return c.json({ error: 'bad-credentials' }, 401);

  const secret = c.env.ADMIN_JWT_SECRET;
  if (!secret) return c.json({ error: 'admin-not-configured' }, 500);

  const nowSec = Math.floor(Date.now() / 1000);
  const token = await signAdminJwt(
    { sub: row.id, iat: nowSec, exp: nowSec + SESSION_TTL_SEC },
    secret,
  );
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
  return c.json({ ok: true, expiresAt: (nowSec + SESSION_TTL_SEC) * 1000 });
});

adminRoute.post('/logout', (c) => {
  setCookie(c, COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  });
  return c.json({ ok: true });
});

// All routes below this point require a valid admin session.
adminRoute.use('*', async (c, next) => {
  if (c.req.path.endsWith('/login') || c.req.path.endsWith('/logout')) return next();
  const secret = c.env.ADMIN_JWT_SECRET;
  if (!secret) return c.json({ error: 'admin-not-configured' }, 500);
  // `getCookie` is typed against Hono's default Context generic so our narrowed
  // `{ Bindings, Variables }` generic is widened to `any` in the helper call.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return c.json({ error: 'unauthorized' }, 401);
  const payload = await verifyAdminJwt(token, secret);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);
  c.set('adminId', payload.sub);
  return next();
});

adminRoute.get('/challenges', async (c) => {
  const from = challengeDateSchema.safeParse(c.req.query('from'));
  const to = challengeDateSchema.safeParse(c.req.query('to'));
  if (!from.success || !to.success) return c.json({ error: 'bad-range' }, 400);
  const list = await listChallenges(c.env.DB, from.data, to.data);
  return c.json({ challenges: list });
});

const upsertInput = dailyChallengeSchema.pick({
  date: true,
  startPage: true,
  endPage: true,
});

adminRoute.put('/challenges/:date', async (c) => {
  const date = challengeDateSchema.safeParse(c.req.param('date'));
  if (!date.success) return c.json({ error: 'bad-date' }, 400);
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = upsertInput.safeParse({
    ...(body && typeof body === 'object' ? body : {}),
    date: date.data,
  });
  if (!parsed.success) return c.json({ error: 'invalid-body' }, 400);
  const createdBy = c.get('adminId');
  await upsertChallenge(
    c.env.DB,
    parsed.data as Omit<DailyChallenge, 'totalCount'>,
    createdBy,
    Date.now(),
  );
  return c.json({ ok: true });
});

adminRoute.delete('/challenges/:date', async (c) => {
  const date = challengeDateSchema.safeParse(c.req.param('date'));
  if (!date.success) return c.json({ error: 'bad-date' }, 400);
  await deleteChallenge(c.env.DB, date.data);
  return c.json({ ok: true });
});

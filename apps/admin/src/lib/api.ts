// Admin-only API client. Credentials are sent via HttpOnly cookie (set by the
// Worker on login), so this client never touches `localStorage` for auth.

import { dailyChallengeSchema, type DailyChallenge } from '@linkle/shared';
import { z } from 'zod';
import { env } from '../config/env.js';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`${String(status)} ${code}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const errorSchema = z.object({ error: z.string() });

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (body: unknown) => T,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  const raw: unknown = await res.json().catch(() => ({ error: 'non-json' }));
  if (!res.ok) {
    const e = errorSchema.safeParse(raw);
    throw new ApiError(res.status, e.success ? e.data.error : 'unknown');
  }
  return parse(raw);
}

const loginResponseSchema = z.object({ ok: z.literal(true), expiresAt: z.number() });

export async function login(username: string, password: string): Promise<{ expiresAt: number }> {
  return request(
    '/v1/admin/login',
    { method: 'POST', body: JSON.stringify({ username, password }) },
    (raw) => loginResponseSchema.parse(raw),
  );
}

export async function logout(): Promise<void> {
  await request('/v1/admin/logout', { method: 'POST' }, () => undefined);
}

const listResponseSchema = z.object({ challenges: z.array(dailyChallengeSchema) });

export async function listChallenges(from: string, to: string): Promise<DailyChallenge[]> {
  const qs = new URLSearchParams({ from, to });
  return request(
    `/v1/admin/challenges?${qs.toString()}`,
    { method: 'GET' },
    (raw) => listResponseSchema.parse(raw).challenges,
  );
}

export async function upsertChallenge(input: {
  date: string;
  startPage: string;
  endPage: string;
}): Promise<void> {
  await request(
    `/v1/admin/challenges/${encodeURIComponent(input.date)}`,
    { method: 'PUT', body: JSON.stringify(input) },
    () => undefined,
  );
}

export async function deleteChallenge(date: string): Promise<void> {
  await request(
    `/v1/admin/challenges/${encodeURIComponent(date)}`,
    { method: 'DELETE' },
    () => undefined,
  );
}

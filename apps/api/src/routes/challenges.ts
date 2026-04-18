import { Hono } from 'hono';
import { challengeDateSchema, getKstToday } from '@linkle/shared';
import type { Env } from '../env.js';
import { getChallenge } from '../db/challenges.js';

export const challengesRoute = new Hono<{ Bindings: Env }>();

challengesRoute.get('/today', async (c) => {
  const today = getKstToday();
  const challenge = await getChallenge(c.env.DB, today);
  if (!challenge) return c.json({ error: 'no-challenge' }, 404);
  return c.json({ challenge });
});

challengesRoute.get('/:date', async (c) => {
  const parse = challengeDateSchema.safeParse(c.req.param('date'));
  if (!parse.success) return c.json({ error: 'bad-date' }, 400);
  const challenge = await getChallenge(c.env.DB, parse.data);
  if (!challenge) return c.json({ error: 'not-found' }, 404);
  return c.json({ challenge });
});

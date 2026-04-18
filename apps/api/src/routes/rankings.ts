import { Hono } from 'hono';
import {
  challengeDateSchema,
  isEndPage,
  rankingSortSchema,
  rankingSubmissionSchema,
  validatePath,
} from '@linkle/shared';
import type { Env } from '../env.js';
import { getChallenge } from '../db/challenges.js';
import { insertRanking, listRankings } from '../db/rankings.js';

export const rankingsRoute = new Hono<{ Bindings: Env }>();

/**
 * Submit a completed run. Server-side validation:
 *   1. The challenge for `challengeDate` exists.
 *   2. The path starts with `startPage` and ends with `endPage` (isEndPage).
 *   3. Structural `validatePath` passes.
 *   4. Uniqueness of (challengeDate, userId) is enforced by a UNIQUE index.
 */
rankingsRoute.post('/', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = rankingSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid-submission', issues: parsed.error.flatten() }, 400);
  }
  const submission = parsed.data;

  const challenge = await getChallenge(c.env.DB, submission.challengeDate);
  if (!challenge) return c.json({ error: 'no-challenge' }, 404);

  const structural = validatePath(submission.path, challenge.startPage, challenge.endPage);
  if (structural.length > 0) {
    return c.json({ error: 'invalid-path', issues: structural }, 400);
  }

  const last = submission.path[submission.path.length - 1];
  if (last?.type !== 'page' || !isEndPage(last.title, challenge.endPage)) {
    return c.json({ error: 'not-at-end-page' }, 400);
  }

  const id = crypto.randomUUID();
  const submittedAt = Date.now();
  try {
    const { rank } = await insertRanking(c.env.DB, id, submission, submittedAt);
    return c.json({ rankingId: id, rank, emojiDeferred: true }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE')) {
      return c.json({ error: 'already-submitted' }, 409);
    }
    throw err;
  }
});

/** GET /v1/rankings/:date?sort=fastest&limit=10 */
rankingsRoute.get('/:date', async (c) => {
  const dateParse = challengeDateSchema.safeParse(c.req.param('date'));
  if (!dateParse.success) return c.json({ error: 'bad-date' }, 400);
  const sortRaw = c.req.query('sort') ?? 'fastest';
  const sortParse = rankingSortSchema.safeParse(sortRaw);
  if (!sortParse.success) return c.json({ error: 'bad-sort' }, 400);
  const limitRaw = Number(c.req.query('limit') ?? '10');
  const limit = Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 10;

  const rankings = await listRankings(c.env.DB, dateParse.data, sortParse.data, limit);
  return c.json({ rankings });
});

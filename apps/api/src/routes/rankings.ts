import { Hono } from 'hono';
import {
  challengeDateSchema,
  isEndPage,
  rankingSortSchema,
  rankingSubmissionSchema,
  renderPathEmoji,
  validatePath,
  type OpenAiReasonEntry,
  type Path,
  type PathEntry,
  type RankingSubmission,
} from '@linkle/shared';
import type { Env } from '../env.js';
import { getChallenge } from '../db/challenges.js';
import { insertRanking, listRankings, updateRankingEmoji } from '../db/rankings.js';
import { scoreSimilarity } from '../lib/openai.js';

export const rankingsRoute = new Hono<{ Bindings: Env }>();

/**
 * Submit a completed run.
 *
 * Server guarantees before writing:
 *   1. The challenge for `challengeDate` exists.
 *   2. The path starts with `startPage` and ends with `endPage` (isEndPage).
 *   3. `validatePath` structural invariants pass.
 *   4. UNIQUE (challengeDate, userId) index rejects duplicate submissions.
 *
 * After insert we score the path synchronously via OpenAI. Players expect
 * the emoji strip on the done screen immediately; asynchronous scoring via
 * `ctx.waitUntil` forces them to refresh which isn't worth the marginal
 * latency win here. If OpenAI errors or times out the row is persisted
 * without an emoji and the client falls back to a "분석 준비 중" label.
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

    const { emojiResult, reason } = await maybeScoreSubmission(
      c.env,
      submission,
      challenge.endPage,
    );
    if (emojiResult !== null) {
      await updateRankingEmoji(c.env.DB, id, emojiResult, JSON.stringify(reason ?? []));
    }

    return c.json({ rankingId: id, rank, emojiResult, reason }, 201);
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

// ─── scoring pipeline ────────────────────────────────────────────────────

interface ScoredResult {
  emojiResult: string | null;
  reason: OpenAiReasonEntry[] | null;
}

async function maybeScoreSubmission(
  env: Env,
  submission: RankingSubmission,
  referenceWord: string,
): Promise<ScoredResult> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return { emojiResult: null, reason: null };

  const path: Path = submission.path;
  const pageEntries = path.filter(
    (p): p is Extract<PathEntry, { type: 'page' }> => p.type === 'page',
  );
  // Score every page except the last one (the goal). `renderPathEmoji`
  // treats the terminal page as the flag emoji regardless of similarity.
  const wordsToScore = pageEntries.slice(0, -1).map((p) => p.title);

  if (wordsToScore.length === 0) {
    return { emojiResult: renderPathEmoji(path, []), reason: [] };
  }

  try {
    const reasons = await scoreSimilarity(referenceWord, wordsToScore, {
      apiKey,
      model: env.OPENAI_MODEL,
      timeoutMs: 15_000,
    });
    const sims: (number | null)[] = [...reasons.map((r) => r.similarity), null];
    return { emojiResult: renderPathEmoji(path, sims), reason: reasons };
  } catch (err) {
    console.warn('[rankings.post] similarity scoring failed', err);
    return { emojiResult: null, reason: null };
  }
}

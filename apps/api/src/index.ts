import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { allowedOrigins, type Env } from './env.js';
import { challengesRoute } from './routes/challenges.js';
import { rankingsRoute } from './routes/rankings.js';
import { statisticsRoute } from './routes/statistics.js';
import { adminRoute } from './routes/admin.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const origins = allowedOrigins(c.env);
  const middleware = cors({
    origin: (incoming) => (origins.includes(incoming) ? incoming : ''),
    credentials: true,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });
  // Hono's `cors` returns a middleware typed against a widened Context; our
  // narrowed { Bindings } generic gets reported as unsafe here, but the call
  // is safe at runtime.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return middleware(c, next);
});

app.get('/', (c) => c.json({ service: 'linkle-api', version: 1 }));
app.get('/v1/health', (c) => c.json({ ok: true, time: Date.now() }));

app.route('/v1/challenges', challengesRoute);
app.route('/v1/rankings', rankingsRoute);
app.route('/v1/statistics', statisticsRoute);
app.route('/v1/admin', adminRoute);

app.notFound((c) => c.json({ error: 'not-found' }, 404));
app.onError((err, c) => {
  console.error('Unhandled error', err);
  return c.json({ error: 'internal' }, 500);
});

export default app;

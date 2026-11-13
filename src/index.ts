import { createPrisma } from './db/client';
import { runSync } from './sync';
import type { Env } from './types';

export default {
  // Hourly cron sweep.
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const db = createPrisma(env.DB);
    ctx.waitUntil(
      runSync(db, env)
        .then((result) => {
          console.log('sync complete', result);
        })
        .finally(() => db.$disconnect()),
    );
  },

  // HTTP surface. Used during local testing to trigger a sweep on demand, and
  // later the mount point for the Discord interactions endpoint.
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (url.pathname === '/sync' && request.method === 'POST') {
      // Optional guard so a deployed worker can't be swept by anyone.
      if (env.SYNC_TOKEN) {
        const auth = request.headers.get('authorization');
        if (auth !== `Bearer ${env.SYNC_TOKEN}`) {
          return new Response('Unauthorized', { status: 401 });
        }
      }
      const db = createPrisma(env.DB);
      try {
        const result = await runSync(db, env);
        return Response.json(result);
      } finally {
        await db.$disconnect();
      }
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

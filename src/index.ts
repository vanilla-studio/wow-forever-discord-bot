import { verifyKey } from 'discord-interactions';

import { createPrisma } from './db/client';
import { handleCommand } from './discord/commands';
import { type Interaction, InteractionResponseType, InteractionType } from './discord/interactions';
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

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (url.pathname === '/interactions' && request.method === 'POST') {
      return handleInteraction(request, env);
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

/** Verifies the Ed25519 signature and dispatches a Discord interaction. */
async function handleInteraction(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();

  if (!signature || !timestamp) {
    return new Response('Missing signature headers', { status: 401 });
  }

  const valid = await verifyKey(body, signature, timestamp, env.DISCORD_APP_PUBLIC_KEY);
  if (!valid) {
    return new Response('Bad request signature', { status: 401 });
  }

  const interaction = JSON.parse(body) as Interaction;

  // Discord's endpoint verification handshake.
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const db = createPrisma(env.DB);
    try {
      return await handleCommand(interaction, db, env);
    } finally {
      await db.$disconnect();
    }
  }

  return new Response('Unsupported interaction type', { status: 400 });
}

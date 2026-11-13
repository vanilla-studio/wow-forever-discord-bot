export interface Env {
  DB: D1Database;

  // Non-secret config (wrangler.jsonc vars).
  WOW_REGION?: string;

  // Secrets (wrangler secret put / .dev.vars).
  BATTLE_NET_CLIENT_ID: string;
  BATTLE_NET_CLIENT_SECRET: string;
  DISCORD_WEBHOOK: string;

  // Optional shared secret to protect the manual sync endpoint.
  SYNC_TOKEN?: string;
}

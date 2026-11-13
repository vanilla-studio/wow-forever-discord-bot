import type { Db } from '../db/client';

// Safety margin so we never use a token that's about to expire mid-run.
const EXPIRY_SKEW_MS = 60_000;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Returns a valid Blizzard client-credentials access token, reusing the cached
 * one in D1 until it is close to expiry, otherwise requesting a fresh token.
 */
export async function getAccessToken(
  db: Db,
  region: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const now = Date.now();

  const cached = await db.oauthToken.findUnique({ where: { region } });
  if (cached && cached.expiresAt.getTime() - EXPIRY_SKEW_MS > now) {
    return cached.accessToken;
  }

  const token = await requestToken(region, clientId, clientSecret);
  const expiresAt = new Date(now + token.expires_in * 1000);

  await db.oauthToken.upsert({
    where: { region },
    create: { region, accessToken: token.access_token, expiresAt },
    update: { accessToken: token.access_token, expiresAt },
  });

  return token.access_token;
}

async function requestToken(
  region: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> {
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(`https://${region}.battle.net/oauth/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Blizzard OAuth failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as TokenResponse;
}

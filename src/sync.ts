import { getAccessToken } from './blizzard/auth';
import { BlizzardClient, pickAvatar } from './blizzard/client';
import { type NormalizedCharacter, normalize } from './blizzard/normalize';
import type { Db } from './db/client';
import type { DiscordEmbed } from './discord/webhook';
import { publishEmbeds } from './discord/webhook';
import { recapColor } from './events/colors';
import { type DetectedEvent, detectEvents } from './events/detect';
import { renderLine, renderRecapLines } from './events/messages';
import type { Character } from './generated/prisma/client';
import type { Env } from './types';

export interface SyncResult {
  checked: number;
  skipped: number;
  announced: number;
}

/** Runs one full sweep: fetch every active character, diff, announce, persist. */
export async function runSync(db: Db, env: Env): Promise<SyncResult> {
  const region = env.WOW_REGION ?? 'eu';
  const token = await getAccessToken(
    db,
    region,
    env.BATTLE_NET_CLIENT_ID,
    env.BATTLE_NET_CLIENT_SECRET,
  );
  const client = new BlizzardClient(region, token);

  const tracked = await db.character.findMany({ where: { active: true } });

  const result: SyncResult = { checked: 0, skipped: 0, announced: 0 };

  for (const character of tracked) {
    const announced = await syncCharacter(db, env, client, character, region);
    if (announced < 0) {
      result.skipped++;
    } else {
      result.checked++;
      result.announced += announced;
    }
  }

  return result;
}

/**
 * Syncs a single character. Returns the number of events announced, or -1 if
 * the character was skipped (profile not available yet).
 */
async function syncCharacter(
  db: Db,
  env: Env,
  client: BlizzardClient,
  character: Character,
  region: string,
): Promise<number> {
  const data = await client.getCharacter(character.slug);
  if (!data) {
    // Not level 10 yet, not logged out, or does not exist. Try again next hour.
    return -1;
  }

  const current = normalize(data);
  const previous = await loadPreviousState(db, character.id);

  const detected = detectEvents(previous, current);

  // Persist the new snapshot regardless, so the next run has a baseline.
  await db.snapshot.create({
    data: {
      characterId: character.id,
      level: current.level,
      equippedItemLevel: current.equippedItemLevel,
      achievementPoints: current.achievementPoints,
      achievementCount: current.achievementCount,
      lastLoginTimestamp: current.lastLoginTimestamp,
      professionsJson: JSON.stringify(current.professions),
      specializationsJson: JSON.stringify(current.activeSpec ?? null),
      achievementsJson: JSON.stringify(current.achievements),
      titlesJson: JSON.stringify(current.titles),
    },
  });

  if (detected.length === 0) {
    return 0;
  }

  // Dedupe guard: record each milestone and keep only the ones not seen before,
  // so a recap never re-announces something from a previous run. D1 has no
  // transactions, so we insert one row at a time and let the unique constraint
  // on (characterId, dedupeKey) reject anything already published.
  const fresh: DetectedEvent[] = [];
  for (const event of detected) {
    const created = await recordEvent(db, character.id, event);
    if (created) {
      fresh.push(event);
    }
  }

  if (fresh.length === 0) {
    return 0;
  }

  // One grouped embed per character per sweep.
  await publishEmbeds(env.DISCORD_WEBHOOK, [buildRecapEmbed(data, current, fresh, region)]);

  return fresh.length;
}

/**
 * Inserts an event row, returning true when it was new and false when the
 * unique (characterId, dedupeKey) constraint rejected it as already published.
 * D1/SQLite has no `skipDuplicates`, so we rely on the constraint and catch the
 * P2002 unique-violation error.
 */
async function recordEvent(db: Db, characterId: number, event: DetectedEvent): Promise<boolean> {
  try {
    await db.event.create({
      data: {
        characterId,
        type: event.type,
        dedupeKey: event.dedupeKey,
        message: renderLine(event),
      },
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return false;
    }
    throw err;
  }
}

/** True when the error is Prisma's unique-constraint violation (P2002). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

/** Builds a single grouped "{name} has been busy" embed for a character. */
function buildRecapEmbed(
  data: NonNullable<Awaited<ReturnType<BlizzardClient['getCharacter']>>>,
  current: NormalizedCharacter,
  fresh: DetectedEvent[],
  region: string,
): DiscordEmbed {
  const name = data.profile.name;
  const className = data.profile.character_class.name;
  const raceName = data.profile.race.name;
  const avatar = pickAvatar(data.media);

  const subtitle = `${raceName} ${className} · now level ${current.level} · iLvl ${current.equippedItemLevel}`;
  const lines = renderRecapLines(fresh);

  return {
    author: { name: `WoW Forever Armory · ${region.toUpperCase()} · ${data.profile.faction.name}` },
    title: `📜 ${name} has been busy`,
    description: `${subtitle}\n\n${lines.join('\n')}`,
    color: recapColor(fresh),
    thumbnail: avatar ? { url: avatar } : undefined,
    footer: { text: 'WoW Forever Armory' },
    timestamp: new Date().toISOString(),
  };
}

/** Rebuilds the previous normalized state from the last stored snapshot. */
async function loadPreviousState(db: Db, characterId: number): Promise<NormalizedCharacter | null> {
  const last = await db.snapshot.findFirst({
    where: { characterId },
    orderBy: { fetchedAt: 'desc' },
  });

  if (!last) {
    return null;
  }

  return {
    level: last.level,
    equippedItemLevel: last.equippedItemLevel,
    achievementPoints: last.achievementPoints,
    achievementCount: last.achievementCount,
    lastLoginTimestamp: last.lastLoginTimestamp ?? undefined,
    professions: safeParse(last.professionsJson, []),
    activeSpec: safeParse(last.specializationsJson, null) ?? undefined,
    achievements: safeParse(last.achievementsJson, []),
    titles: safeParse(last.titlesJson, []),
  };
}

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) {
    return fallback;
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

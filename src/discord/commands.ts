import { getAccessToken } from '../blizzard/auth';
import { BlizzardClient, pickAvatar } from '../blizzard/client';
import type { CharacterProfile } from '../blizzard/types';
import type { Db } from '../db/client';
import type { Env } from '../types';
import { Colors, factionColor } from './colors';
import {
  embedReply,
  getOption,
  getSubcommand,
  type Interaction,
  invokerId,
  isAdmin,
} from './interactions';
import { isValidSlug, normalizeSlug } from './slug';

/** Routes a `/wow-forever <sub>` interaction to its handler. */
export async function handleCommand(interaction: Interaction, db: Db, env: Env): Promise<Response> {
  if (interaction.data?.name !== 'wow-forever') {
    return errorEmbed('Unknown command', `\`${interaction.data?.name}\` isn't something I know.`);
  }

  const sub = getSubcommand(interaction);
  switch (sub) {
    case 'follow':
      return follow(interaction, db);
    case 'unfollow':
      return unfollow(interaction, db);
    case 'list':
      return list(interaction, db);
    case 'check':
      return check(interaction, db, env);
    default:
      return errorEmbed('Unknown sub-command', `\`${sub}\` isn't something I know.`);
  }
}

// ── Embed builders for the common reply shapes ──────────────────────────────

/** Green success embed, public by default. */
function successEmbed(title: string, description: string, ephemeral = false): Response {
  return embedReply({ title, description, color: Colors.success }, ephemeral);
}

/** Amber "you can't do that" embed, always ephemeral. */
function deniedEmbed(title: string, description: string): Response {
  return embedReply({ title, description, color: Colors.denied }, true);
}

/** Red error embed, always ephemeral. */
function errorEmbed(title: string, description: string): Response {
  return embedReply({ title, description, color: Colors.error }, true);
}

// A valid-slug guard shared by /follow and /check.
function invalidSlugEmbed(slug: string): Response {
  return errorEmbed(
    "⚠️ That's not a character",
    `\`${slug || '(empty)'}\` doesn't look right. Use **name-surname**, e.g. \`raekwon-rosebrook\`.`,
  );
}

// ── Commands ────────────────────────────────────────────────────────────────

// /follow <character> — anyone can follow a character.
async function follow(interaction: Interaction, db: Db): Promise<Response> {
  const region = regionOf(interaction);
  const slug = normalizeSlug(getOption(interaction, 'character') ?? '');
  const userId = invokerId(interaction);

  if (!isValidSlug(slug)) {
    return invalidSlugEmbed(slug);
  }

  const existing = await db.character.findUnique({ where: { slug_region: { slug, region } } });

  if (existing?.active) {
    return deniedEmbed('Already on the list', `**${prettySlug(slug)}** is already being followed.`);
  }

  if (existing) {
    await db.character.update({ where: { id: existing.id }, data: { active: true } });
  } else {
    await db.character.create({ data: { slug, region, addedBy: userId, active: true } });
  }

  const owner = userId ? ` Added by <@${userId}>.` : '';
  return successEmbed(
    `✅ Now following ${prettySlug(slug)}`,
    `I'll shout whenever they level up or skill up.${owner}`,
  );
}

// /unfollow <character> — only the owner (who followed it) or an admin.
async function unfollow(interaction: Interaction, db: Db): Promise<Response> {
  const region = regionOf(interaction);
  const slug = normalizeSlug(getOption(interaction, 'character') ?? '');
  const userId = invokerId(interaction);
  const admin = isAdmin(interaction);

  const character = await db.character.findUnique({ where: { slug_region: { slug, region } } });

  if (!character?.active) {
    return deniedEmbed('Not on the list', `**${prettySlug(slug)}** isn't being followed.`);
  }

  const isOwner = character.addedBy && character.addedBy === userId;
  if (!isOwner && !admin) {
    return deniedEmbed(
      '🔒 Not your call',
      `Only the one who followed **${prettySlug(slug)}** — or an admin — can unfollow them.`,
    );
  }

  await db.character.update({ where: { id: character.id }, data: { active: false } });
  return successEmbed(`🫡 Stopped following ${prettySlug(slug)}`, 'Their glow-ups go unsung now.');
}

// /list — admins only. Lists every actively followed character.
async function list(interaction: Interaction, db: Db): Promise<Response> {
  if (!isAdmin(interaction)) {
    return deniedEmbed('🔒 Admins only', 'Only admins can list the followed characters.');
  }

  const characters = await db.character.findMany({
    where: { active: true },
    orderBy: { slug: 'asc' },
  });

  if (characters.length === 0) {
    return embedReply(
      {
        title: '📋 Nobody followed yet',
        description: 'Use `/wow-forever follow` to start tracking someone.',
        color: Colors.info,
      },
      true,
    );
  }

  const lines = characters.map((c) => {
    const owner = c.addedBy ? `<@${c.addedBy}>` : 'unknown';
    return `• **${prettySlug(c.slug)}** (${c.region.toUpperCase()}) — ${owner}`;
  });
  return embedReply(
    {
      title: `📋 Following ${characters.length} character${characters.length === 1 ? '' : 's'}`,
      description: lines.join('\n'),
      color: Colors.info,
    },
    true,
  );
}

// /check <character> — anyone. Live armory card of the character right now.
async function check(interaction: Interaction, db: Db, env: Env): Promise<Response> {
  const region = regionOf(interaction);
  const slug = normalizeSlug(getOption(interaction, 'character') ?? '');

  if (!isValidSlug(slug)) {
    return invalidSlugEmbed(slug);
  }

  const token = await getAccessToken(
    db,
    region,
    env.BATTLE_NET_CLIENT_ID,
    env.BATTLE_NET_CLIENT_SECRET,
  );
  const client = new BlizzardClient(region, token);
  const data = await client.getCharacter(slug);

  if (!data) {
    return errorEmbed(
      '🔍 Not found',
      `Couldn't find **${prettySlug(slug)}** on the ${region.toUpperCase()} armory. Characters show up only from level 10, after logging out.`,
    );
  }

  const p = data.profile;
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: 'Item level', value: String(p.equipped_item_level), inline: true },
    { name: 'Achievements', value: String(data.achievements.total_quantity), inline: true },
  ];
  if (p.last_login_timestamp) {
    // Discord renders this as a live relative time ("2 hours ago").
    const secs = Math.floor(p.last_login_timestamp / 1000);
    fields.push({ name: 'Last seen', value: `<t:${secs}:R>`, inline: true });
  }

  const profs = (data.professions.primaries ?? [])
    .map((entry) => {
      const top = (entry.tiers ?? []).at(-1);
      return top
        ? `**${entry.profession.name}** — ${top.skill_points}/${top.max_skill_points}`
        : null;
    })
    .filter((x): x is string => x !== null);
  if (profs.length > 0) {
    fields.push({ name: 'Professions', value: profs.join('\n'), inline: false });
  }

  const avatar = pickAvatar(data.media);
  return embedReply({
    author: { name: `WoW Forever Armory · ${region.toUpperCase()} · ${p.faction.name}` },
    title: displayName(p),
    description: `Level ${p.level} ${p.race.name} ${p.character_class.name}`,
    color: factionColor(p.faction.name),
    thumbnail: avatar ? { url: avatar } : undefined,
    fields,
    footer: { text: 'WoW Forever Armory' },
    timestamp: new Date().toISOString(),
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** "raekwon-rosebrook" -> "Raekwon Rosebrook" for display. */
function prettySlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Full display name from a profile, e.g. "Raekwon Rosebrook". */
function displayName(p: CharacterProfile): string {
  return p.surname ? `${p.name} ${p.surname}` : p.name;
}

// Characters are followed per-region; default to the guild's configured region.
function regionOf(_interaction: Interaction): string {
  return 'eu';
}

import { getAccessToken } from '../blizzard/auth';
import { BlizzardClient } from '../blizzard/client';
import type { Db } from '../db/client';
import type { Env } from '../types';
import {
  ephemeralReply,
  getOption,
  getSubcommand,
  type Interaction,
  invokerId,
  isAdmin,
  publicReply,
} from './interactions';
import { isValidSlug, normalizeSlug } from './slug';

/** Routes a `/wow-forever <sub>` interaction to its handler. */
export async function handleCommand(interaction: Interaction, db: Db, env: Env): Promise<Response> {
  if (interaction.data?.name !== 'wow-forever') {
    return ephemeralReply(`Unknown command: \`${interaction.data?.name}\`.`);
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
      return ephemeralReply(`Unknown sub-command: \`${sub}\`.`);
  }
}

// /follow <character> — anyone can follow a character.
async function follow(interaction: Interaction, db: Db): Promise<Response> {
  const region = regionOf(interaction);
  const slug = normalizeSlug(getOption(interaction, 'character') ?? '');
  const userId = invokerId(interaction);

  if (!isValidSlug(slug)) {
    return ephemeralReply(
      `\`${slug || '(empty)'}\` doesn't look like a valid character. Use **name-surname**, e.g. \`raekwon-rosebrook\`.`,
    );
  }

  const existing = await db.character.findUnique({
    where: { slug_region: { slug, region } },
  });

  if (existing?.active) {
    return ephemeralReply(`**${slug}** is already being followed.`);
  }

  if (existing) {
    // Reactivate a previously unfollowed character, keeping original owner.
    await db.character.update({ where: { id: existing.id }, data: { active: true } });
  } else {
    await db.character.create({ data: { slug, region, addedBy: userId, active: true } });
  }

  return publicReply(`✅ Now following **${slug}**. I'll shout about their glow-ups.`);
}

// /unfollow <character> — only the owner (who followed it) or an admin.
async function unfollow(interaction: Interaction, db: Db): Promise<Response> {
  const region = regionOf(interaction);
  const slug = normalizeSlug(getOption(interaction, 'character') ?? '');
  const userId = invokerId(interaction);
  const admin = isAdmin(interaction);

  const character = await db.character.findUnique({
    where: { slug_region: { slug, region } },
  });

  if (!character?.active) {
    return ephemeralReply(`**${slug}** isn't being followed.`);
  }

  const isOwner = character.addedBy && character.addedBy === userId;
  if (!isOwner && !admin) {
    return ephemeralReply(
      `Only the person who followed **${slug}** (or an admin) can unfollow it.`,
    );
  }

  await db.character.update({ where: { id: character.id }, data: { active: false } });
  return publicReply(`🫡 Stopped following **${slug}**.`);
}

// /list — admins only. Lists every actively followed character.
async function list(interaction: Interaction, db: Db): Promise<Response> {
  if (!isAdmin(interaction)) {
    return ephemeralReply('Only admins can list the followed characters.');
  }

  const characters = await db.character.findMany({
    where: { active: true },
    orderBy: { slug: 'asc' },
  });

  if (characters.length === 0) {
    return ephemeralReply('Nobody is being followed yet. Use `/follow` to start.');
  }

  const lines = characters.map((c) => {
    const owner = c.addedBy ? `<@${c.addedBy}>` : 'unknown';
    return `• **${c.slug}** (${c.region.toUpperCase()}) — added by ${owner}`;
  });
  return ephemeralReply(`Following ${characters.length} character(s):\n${lines.join('\n')}`);
}

// /check <character> — anyone. Live snapshot of the character right now.
async function check(interaction: Interaction, db: Db, env: Env): Promise<Response> {
  const region = regionOf(interaction);
  const slug = normalizeSlug(getOption(interaction, 'character') ?? '');

  if (!isValidSlug(slug)) {
    return ephemeralReply(
      `\`${slug || '(empty)'}\` doesn't look like a valid character. Use **name-surname**.`,
    );
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
    return ephemeralReply(
      `Couldn't find **${slug}** on the ${region.toUpperCase()} armory. Characters show up only from level 10, after logging out.`,
    );
  }

  const p = data.profile;
  const profs = (data.professions.primaries ?? [])
    .map((entry) => {
      const top = (entry.tiers ?? []).at(-1);
      return top ? `${entry.profession.name} ${top.skill_points}/${top.max_skill_points}` : null;
    })
    .filter((x): x is string => x !== null);

  const lines = [
    `**${p.name}** — ${p.race.name} ${p.character_class.name} (${p.faction.name})`,
    `Level ${p.level} · iLvl ${p.equipped_item_level} · ${data.achievements.total_quantity} achievements`,
    profs.length > 0 ? `Professions: ${profs.join(', ')}` : 'No primary professions yet',
  ];
  return publicReply(lines.join('\n'));
}

// Characters are followed per-region; default to the guild's configured region.
function regionOf(_interaction: Interaction): string {
  return 'eu';
}

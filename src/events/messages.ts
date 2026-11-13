import type { DetectedEvent } from './detect';

// Sharp, dry one-liners. The character name lives in the embed title, so the
// lines here never repeat it — they just describe what happened, with bite.
// `{x}` is the event-specific value (a level, a rank, an achievement name).

const LEVEL_UP = [
  '🎉 Dinged **level {x}**. Two levels, zero witnesses, allegedly.',
  '📈 Reached **level {x}**. Sleep is a config option they left disabled.',
  '⚔️ Now **level {x}**. The grass outside remains tragically untouched.',
  '🗡️ Hit **level {x}**. Somewhere, a quest giver sighs in relief.',
];

const LEVEL_CAP = [
  '👑 Hit **level 60** — the cap. The journey is over; the denial begins.',
  '🏆 **Level 60.** Peak achieved. Life, however, remains unaddressed.',
  '🎓 Dinged **60**. Graduated from the School of No Social Life with honors.',
];

const PROFESSION_TIER = [
  '⚒️ Made **{rank} {profession}**. The guild bank quietly weeps.',
  '🛠️ Ranked up to **{rank}** in **{profession}**. Calluses: fully acquired.',
  '🧵 **{rank} {profession}** now. The auction house braces for impact.',
];

const ACHIEVEMENT = [
  '🏅 Earned **{x}**. A low bar, cleared with suspicious pride.',
  '✨ Unlocked **{x}**. The résumé grows; the self-awareness does not.',
  '🎖️ Bagged **{x}**. Framed it, probably.',
];

const TITLE = [
  '📜 Unlocked the title **{x}**. Address them properly from now on.',
  '👔 New title: **{x}**. Insufferable in the best way.',
];

const ITEM_LEVEL = [
  '🛡️ Gear check: item level up to **{to}**. Looking less like a vendor reject.',
  '💪 Item level **{to}** now (+{gain}). The drip is drizzling.',
];

const FIRST_EPIC = [
  '🟣 **FIRST EPIC EQUIPPED.** Purple pixels. We are not worthy. (We are, slightly.)',
  '🟣 A wild **EPIC** appears — equipped and flexed. Frame this moment.',
];

const SPEC_CHANGE = [
  '🌀 Respecced from **{from}** to **{to}**. The trainer sends their regards and an invoice.',
  '🔀 New spec: **{to}** (was {from}). Commitment issues, but make it talents.',
];

const GUILD_JOIN = [
  '🚪 Joined the guild **{to}**. Fresh meat for the roster.',
  '🤝 Now flying the **{to}** tabard. Welcome aboard.',
];

const GUILD_LEAVE = [
  '🚪 Left **{from}**. Gone to find themselves, or just better loot rules.',
  '👋 No longer repping **{from}**. Guildless and free.',
];

const GUILD_SWITCH = ['🔁 Jumped ship from **{from}** to **{to}**. Loyalty is a spectrum.'];

const DEATHS = [
  '💀 Reached **{count} deaths**. A connoisseur of the respawn screen.',
  '⚰️ **{count} deaths** and counting. The spirit healer knows them by name.',
  '🪦 Death #**{count}**. Azeroth remains undefeated.',
];

const FALLING_DEATH = [
  '🪂 Died from fall damage. Again. Gravity: {count} — common sense: 0.',
  '🧗 Another **falling death** (#{count}). The ground said hello.',
  '⛰️ Learned — once more — that cliffs are not shortcuts. Falling deaths: **{count}**.',
];

const QUESTS = [
  '📜 Completed **{count} quests**. The errand boy of Azeroth marches on.',
  '✅ **{count} quests** done. Someone really reads all that yellow text.',
];

function pick(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Renders a single event as one embed line (no character name). */
export function renderLine(event: DetectedEvent): string {
  switch (event.type) {
    case 'level-up': {
      const level = event.data.level as number;
      const template = event.data.isCap ? pick(LEVEL_CAP) : pick(LEVEL_UP);
      return fill(template, { x: String(level) });
    }
    case 'profession-tier':
      return fill(pick(PROFESSION_TIER), {
        profession: event.data.profession as string,
        rank: event.data.rank as string,
      });
    case 'achievement':
      return fill(pick(ACHIEVEMENT), { x: event.data.name as string });
    case 'title':
      return fill(pick(TITLE), { x: event.data.name as string });
    case 'item-level': {
      const to = event.data.to as number;
      const from = event.data.from as number;
      return fill(pick(ITEM_LEVEL), { to: String(to), gain: String(to - from) });
    }
    case 'first-epic':
      return pick(FIRST_EPIC);
    case 'spec-change':
      return fill(pick(SPEC_CHANGE), {
        from: event.data.from as string,
        to: event.data.to as string,
      });
    case 'guild-change': {
      const from = event.data.from as string | undefined;
      const to = event.data.to as string | undefined;
      if (from && to) {
        return fill(pick(GUILD_SWITCH), { from, to });
      }
      if (to) {
        return fill(pick(GUILD_JOIN), { to });
      }
      return fill(pick(GUILD_LEAVE), { from: from ?? 'their guild' });
    }
    case 'deaths':
      return fill(pick(DEATHS), { count: String(event.data.count) });
    case 'falling-death':
      return fill(pick(FALLING_DEATH), { count: String(event.data.count) });
    case 'quests':
      return fill(pick(QUESTS), { count: String(event.data.count) });
    default:
      return '• Did something noteworthy.';
  }
}

/**
 * Renders the event lines for one character's recap. Consecutive level-ups are
 * collapsed into a single range line so a two-level jump reads as one event.
 */
export function renderRecapLines(events: DetectedEvent[]): string[] {
  const levelUps = events
    .filter((e) => e.type === 'level-up')
    .map((e) => e.data.level as number)
    .sort((a, b) => a - b);
  const others = events.filter((e) => e.type !== 'level-up');

  const lines: string[] = [];

  if (levelUps.length === 1) {
    lines.push(renderLine(events.find((e) => e.type === 'level-up') as DetectedEvent));
  } else if (levelUps.length > 1) {
    const from = levelUps[0];
    const to = levelUps[levelUps.length - 1];
    const hitCap = levelUps.includes(60);
    lines.push(
      hitCap
        ? `🎉 Tore from **${from} all the way to 60** — the cap. Touch grass immediately.`
        : `🎉 Clawed from **${from} to ${to}**. ${to - from + 1} levels, zero witnesses.`,
    );
  }

  for (const event of others) {
    lines.push(renderLine(event));
  }

  return lines;
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

import type { DetectedEvent, EventType } from './detect';

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

const POOLS: Record<Exclude<EventType, 'level-up'>, string[]> = {
  'profession-tier': PROFESSION_TIER,
  achievement: ACHIEVEMENT,
  title: TITLE,
  'item-level': [],
};

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

// Re-export so callers can reference the pool table if needed.
export { POOLS };

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

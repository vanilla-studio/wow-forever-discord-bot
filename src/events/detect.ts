import type { NormalizedCharacter } from '../blizzard/normalize';

export type EventType =
  | 'level-up'
  | 'profession-tier'
  | 'achievement'
  | 'title'
  | 'item-level'
  | 'first-epic'
  | 'spec-change'
  | 'guild-change'
  | 'deaths'
  | 'falling-death'
  | 'quests';

export interface DetectedEvent {
  type: EventType;
  // Stable identity so the same milestone is never announced twice.
  dedupeKey: string;
  // Structured payload the message layer turns into goliardic prose.
  data: Record<string, unknown>;
}

/**
 * Diffs the previous normalized state against the current one and returns the
 * list of noteworthy events. `previous` is null on the very first sighting of a
 * character — in that case we only establish a baseline and announce nothing,
 * to avoid spamming the whole backlog on day one.
 */
export function detectEvents(
  previous: NormalizedCharacter | null,
  current: NormalizedCharacter,
): DetectedEvent[] {
  if (!previous) {
    return [];
  }

  const events: DetectedEvent[] = [];

  // Level up — every single level.
  if (current.level > previous.level) {
    for (let lvl = previous.level + 1; lvl <= current.level; lvl++) {
      events.push({
        type: 'level-up',
        dedupeKey: `level-up:${lvl}`,
        data: { level: lvl, isCap: lvl === 60 },
      });
    }
  }

  // Profession tier change — only when a profession reaches a new tier.
  const prevProfs = new Map(previous.professions.map((p) => [p.id, p]));
  for (const prof of current.professions) {
    const before = prevProfs.get(prof.id);
    // Only announce when an already-tracked profession climbs to a new rank.
    // A brand-new profession between snapshots just establishes its baseline.
    if (before && prof.rank !== before.rank) {
      events.push({
        type: 'profession-tier',
        dedupeKey: `profession-tier:${prof.id}:${prof.rank}`,
        data: {
          profession: prof.name,
          rank: prof.rank,
          maxSkillPoints: prof.maxSkillPoints,
        },
      });
    }
  }

  // New achievements.
  const prevAchievements = new Set(previous.achievements.map((a) => a.id));
  for (const ach of current.achievements) {
    if (!prevAchievements.has(ach.id)) {
      events.push({
        type: 'achievement',
        dedupeKey: `achievement:${ach.id}`,
        data: { name: ach.name },
      });
    }
  }

  // New titles.
  const prevTitles = new Set(previous.titles.map((t) => t.id));
  for (const title of current.titles) {
    if (!prevTitles.has(title.id)) {
      events.push({
        type: 'title',
        dedupeKey: `title:${title.id}`,
        data: { name: title.name },
      });
    }
  }

  // Item level climbed by a meaningful amount (avoids spamming every piece).
  const ilvlGain = current.equippedItemLevel - previous.equippedItemLevel;
  if (ilvlGain >= ITEM_LEVEL_STEP) {
    events.push({
      type: 'item-level',
      dedupeKey: `item-level:${current.equippedItemLevel}`,
      data: { from: previous.equippedItemLevel, to: current.equippedItemLevel },
    });
  }

  // First epic ever equipped — a one-off celebratory moment.
  if (previous.epicCount === 0 && current.epicCount > 0) {
    events.push({ type: 'first-epic', dedupeKey: 'first-epic', data: {} });
  }

  // Spec change (main spec id changed).
  if (
    previous.activeSpec &&
    current.activeSpec &&
    previous.activeSpec.id !== current.activeSpec.id
  ) {
    events.push({
      type: 'spec-change',
      dedupeKey: `spec-change:${current.activeSpec.id}`,
      data: { from: previous.activeSpec.name, to: current.activeSpec.name },
    });
  }

  // Guild change (joined, left, or switched).
  if ((previous.guild ?? '') !== (current.guild ?? '')) {
    events.push({
      type: 'guild-change',
      dedupeKey: `guild-change:${current.guild ?? 'none'}`,
      data: { from: previous.guild, to: current.guild },
    });
  }

  // Death-count milestones (every DEATH_STEP deaths).
  for (const milestone of milestonesCrossed(
    previous.totalDeaths,
    current.totalDeaths,
    DEATH_STEP,
  )) {
    events.push({ type: 'deaths', dedupeKey: `deaths:${milestone}`, data: { count: milestone } });
  }

  // A new falling death (every single one — too funny to batch).
  if (current.fallingDeaths > previous.fallingDeaths) {
    events.push({
      type: 'falling-death',
      dedupeKey: `falling-death:${current.fallingDeaths}`,
      data: { count: current.fallingDeaths },
    });
  }

  // Quest-completion milestones (every QUEST_STEP quests).
  for (const milestone of milestonesCrossed(
    previous.questsCompleted,
    current.questsCompleted,
    QUEST_STEP,
  )) {
    events.push({ type: 'quests', dedupeKey: `quests:${milestone}`, data: { count: milestone } });
  }

  return events;
}

const ITEM_LEVEL_STEP = 3;
const DEATH_STEP = 10;
const QUEST_STEP = 100;

/**
 * Returns the milestone values of `step` strictly above `from` and at most `to`.
 * E.g. from=8, to=23, step=10 -> [10, 20]. Empty when nothing new is crossed.
 */
function milestonesCrossed(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.floor(from / step) * step + step;
  for (let m = first; m <= to; m += step) {
    out.push(m);
  }
  return out;
}

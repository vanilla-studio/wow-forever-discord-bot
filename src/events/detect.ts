import type { NormalizedCharacter } from '../blizzard/normalize';

export type EventType = 'level-up' | 'profession-tier' | 'achievement' | 'title' | 'item-level';

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

  return events;
}

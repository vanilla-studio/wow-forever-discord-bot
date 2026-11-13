import type { CharacterData } from './client';

// Compact shapes we persist in snapshots and diff against. Keeping them small
// and stable makes the JSON columns cheap to store and easy to compare.

export interface NormalizedProfession {
  id: number;
  name: string;
  // Highest tier currently known for this profession.
  tierId: number;
  tierName: string;
  skillPoints: number;
  maxSkillPoints: number;
  // Classic rank derived from max skill points (Apprentice..Master).
  rank: string;
}

export interface NormalizedSpec {
  id: number;
  name: string;
  spentPoints: number;
}

export interface NormalizedAchievement {
  id: number;
  name: string;
  completedTimestamp?: number;
}

export interface NormalizedTitle {
  id: number;
  name: string;
}

export interface NormalizedCharacter {
  level: number;
  equippedItemLevel: number;
  achievementPoints: number;
  achievementCount: number;
  lastLoginTimestamp?: number;
  professions: NormalizedProfession[];
  activeSpec?: NormalizedSpec;
  achievements: NormalizedAchievement[];
  titles: NormalizedTitle[];
}

export function normalize(data: CharacterData): NormalizedCharacter {
  return {
    level: data.profile.level,
    equippedItemLevel: data.profile.equipped_item_level,
    achievementPoints: data.profile.achievement_points,
    achievementCount: data.achievements.total_quantity,
    lastLoginTimestamp: data.profile.last_login_timestamp,
    professions: normalizeProfessions(data),
    activeSpec: normalizeActiveSpec(data),
    achievements: normalizeAchievements(data),
    titles: normalizeTitles(data),
  };
}

function normalizeProfessions(data: CharacterData): NormalizedProfession[] {
  const primaries = data.professions.primaries ?? [];
  const result: NormalizedProfession[] = [];

  for (const entry of primaries) {
    const tiers = entry.tiers ?? [];
    if (tiers.length === 0) {
      continue;
    }
    // The highest tier is the current one for Classic-era professions.
    const top = tiers.reduce((a, b) => (b.max_skill_points > a.max_skill_points ? b : a));
    result.push({
      id: entry.profession.id,
      name: entry.profession.name,
      tierId: top.tier.id,
      tierName: top.tier.name,
      skillPoints: top.skill_points,
      maxSkillPoints: top.max_skill_points,
      rank: classicRank(top.max_skill_points),
    });
  }

  return result;
}

// Classic profession ranks map to the cap of each tier.
function classicRank(maxSkillPoints: number): string {
  if (maxSkillPoints >= 375) return 'Master';
  if (maxSkillPoints >= 300) return 'Artisan';
  if (maxSkillPoints >= 225) return 'Expert';
  if (maxSkillPoints >= 150) return 'Journeyman';
  return 'Apprentice';
}

function normalizeActiveSpec(data: CharacterData): NormalizedSpec | undefined {
  const groups = data.specializations.specialization_groups ?? [];
  const active = groups.find((g) => g.is_active) ?? groups[0];
  const specs = active?.specializations ?? [];
  if (specs.length === 0) {
    return undefined;
  }
  // The spec with the most spent points is the character's main.
  const main = specs.reduce((a, b) => ((b.spent_points ?? 0) > (a.spent_points ?? 0) ? b : a));
  return {
    id: main.specialization.id,
    name: main.specialization_name ?? main.specialization.name,
    spentPoints: main.spent_points ?? 0,
  };
}

function normalizeAchievements(data: CharacterData): NormalizedAchievement[] {
  return (data.achievements.achievements ?? [])
    .filter((a) => a.criteria?.is_completed !== false && a.completed_timestamp)
    .map((a) => ({
      id: a.achievement.id,
      name: a.achievement.name,
      completedTimestamp: a.completed_timestamp,
    }));
}

function normalizeTitles(data: CharacterData): NormalizedTitle[] {
  return (data.titles.titles ?? []).map((t) => ({ id: t.id, name: t.name }));
}

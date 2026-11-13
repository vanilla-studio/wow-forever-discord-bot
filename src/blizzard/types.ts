// Minimal typings for the Blizzard WoW Forever profile API responses.
// Only the fields we actually read are modeled; everything else is ignored.

interface KeyRef {
  key?: { href: string };
  name: string;
  id: number;
}

export interface CharacterProfile {
  id: number;
  name: string;
  // Forever characters are realmless and carry a surname instead.
  surname?: string;
  level: number;
  achievement_points: number;
  average_item_level: number;
  equipped_item_level: number;
  last_login_timestamp?: number;
  character_class: KeyRef;
  race: KeyRef;
  faction: { type: string; name: string };
}

export interface ProfessionsResponse {
  primaries?: ProfessionEntry[];
  secondaries?: ProfessionEntry[];
}

export interface ProfessionEntry {
  profession: KeyRef;
  tiers?: ProfessionTier[];
}

export interface ProfessionTier {
  skill_points: number;
  max_skill_points: number;
  tier: { name: string; id: number };
}

export interface SpecializationsResponse {
  specialization_groups?: SpecializationGroup[];
}

export interface SpecializationGroup {
  is_active?: boolean;
  specializations?: Array<{
    specialization: { name: string; id: number };
    specialization_name?: string;
    spent_points?: number;
  }>;
}

export interface AchievementsResponse {
  total_quantity: number;
  total_points: number;
  achievements?: Array<{
    id: number;
    achievement: { name: string; id: number };
    criteria?: { is_completed?: boolean };
    completed_timestamp?: number;
  }>;
}

export interface TitlesResponse {
  active_title?: { id: number; name: string };
  titles?: Array<{ id: number; name: string }>;
}

export interface CharacterMediaResponse {
  assets?: Array<{ key: string; value: string }>;
}

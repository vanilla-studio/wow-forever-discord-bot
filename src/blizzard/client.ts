import type {
  AchievementsResponse,
  CharacterMediaResponse,
  CharacterProfile,
  ProfessionsResponse,
  SpecializationsResponse,
  TitlesResponse,
} from './types';

export interface CharacterData {
  profile: CharacterProfile;
  professions: ProfessionsResponse;
  specializations: SpecializationsResponse;
  achievements: AchievementsResponse;
  titles: TitlesResponse;
  media: CharacterMediaResponse;
}

export class BlizzardClient {
  private readonly base: string;
  private readonly namespace: string;

  constructor(
    region: string,
    private readonly token: string,
  ) {
    this.base = `https://${region}.api.blizzard.com`;
    this.namespace = `profile-forever-${region}`;
  }

  /**
   * Fetches a character profile plus every sub-endpoint we care about.
   * Returns null when the character profile itself 404s (not yet level 10,
   * not logged out yet, or does not exist).
   */
  async getCharacter(slug: string): Promise<CharacterData | null> {
    const profile = await this.get<CharacterProfile>(`/profile/wow/character/${slug}`);
    if (!profile) {
      return null;
    }

    // Sub-endpoints can lag behind the profile (media especially), so a 404
    // here is non-fatal — we fall back to empty shapes and diff what we have.
    const [professions, specializations, achievements, titles, media] = await Promise.all([
      this.get<ProfessionsResponse>(`/profile/wow/character/${slug}/professions`),
      this.get<SpecializationsResponse>(`/profile/wow/character/${slug}/specializations`),
      this.get<AchievementsResponse>(`/profile/wow/character/${slug}/achievements`),
      this.get<TitlesResponse>(`/profile/wow/character/${slug}/titles`),
      this.get<CharacterMediaResponse>(`/profile/wow/character/${slug}/character-media`),
    ]);

    return {
      profile,
      professions: professions ?? {},
      specializations: specializations ?? {},
      achievements: achievements ?? { total_quantity: 0, total_points: 0 },
      titles: titles ?? {},
      media: media ?? {},
    };
  }

  private async get<T>(path: string): Promise<T | null> {
    const url = `${this.base}${path}?namespace=${this.namespace}&locale=en_US`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${this.token}` },
    });

    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Blizzard API ${res.status} on ${path}: ${await res.text()}`);
    }

    return (await res.json()) as T;
  }
}

/** Picks the best available portrait/render URL from the media assets. */
export function pickAvatar(media: CharacterMediaResponse): string | undefined {
  const assets = media.assets ?? [];
  const byKey = (key: string) => assets.find((a) => a.key === key)?.value;
  return byKey('avatar') ?? byKey('avatar-sd') ?? byKey('main-raw');
}

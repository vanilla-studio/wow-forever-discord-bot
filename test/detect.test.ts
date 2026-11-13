import { describe, expect, it } from 'vitest';

import type { NormalizedCharacter } from '../src/blizzard/normalize';
import { detectEvents } from '../src/events/detect';

function baseState(overrides: Partial<NormalizedCharacter> = {}): NormalizedCharacter {
  return {
    level: 29,
    equippedItemLevel: 18,
    achievementPoints: 0,
    achievementCount: 4,
    lastLoginTimestamp: 1794566230000,
    professions: [
      {
        id: 165,
        name: 'Leatherworking',
        tierId: 2945,
        tierName: 'Leatherworking',
        skillPoints: 136,
        maxSkillPoints: 150,
        rank: 'Journeyman',
      },
    ],
    activeSpec: { id: 574, name: 'Balance', spentPoints: 4 },
    achievements: [{ id: 61502, name: 'Novice Druid', completedTimestamp: 1794341580000 }],
    titles: [],
    guild: undefined,
    epicCount: 0,
    totalDeaths: 0,
    fallingDeaths: 0,
    questsCompleted: 0,
    ...overrides,
  };
}

describe('detectEvents', () => {
  it('announces nothing on the first sighting (baseline)', () => {
    expect(detectEvents(null, baseState())).toEqual([]);
  });

  it('announces nothing when nothing changed', () => {
    expect(detectEvents(baseState(), baseState())).toEqual([]);
  });

  it('emits one level-up event per level crossed', () => {
    const previous = baseState({ level: 27 });
    const current = baseState({ level: 29 });

    const events = detectEvents(previous, current);
    const levelUps = events.filter((e) => e.type === 'level-up');

    expect(levelUps.map((e) => e.dedupeKey)).toEqual(['level-up:28', 'level-up:29']);
  });

  it('flags the level cap', () => {
    const events = detectEvents(baseState({ level: 59 }), baseState({ level: 60 }));
    const cap = events.find((e) => e.dedupeKey === 'level-up:60');
    expect(cap?.data.isCap).toBe(true);
  });

  it('announces a profession rank up with a rank-scoped dedupe key', () => {
    const previous = baseState({
      professions: [
        {
          id: 165,
          name: 'Leatherworking',
          tierId: 2945,
          tierName: 'Leatherworking',
          skillPoints: 70,
          maxSkillPoints: 75,
          rank: 'Apprentice',
        },
      ],
    });
    const current = baseState(); // Journeyman

    const events = detectEvents(previous, current);
    const prof = events.find((e) => e.type === 'profession-tier');

    expect(prof?.dedupeKey).toBe('profession-tier:165:Journeyman');
    expect(prof?.data).toMatchObject({ profession: 'Leatherworking', rank: 'Journeyman' });
  });

  it('does not announce a brand-new profession (no baseline to compare)', () => {
    const previous = baseState({ professions: [] });
    const current = baseState();

    const profEvents = detectEvents(previous, current).filter((e) => e.type === 'profession-tier');
    expect(profEvents).toEqual([]);
  });

  it('announces only newly earned achievements', () => {
    const previous = baseState();
    const current = baseState({
      achievements: [
        { id: 61502, name: 'Novice Druid' },
        { id: 62017, name: 'Explore Moonglade' },
      ],
    });

    const achievements = detectEvents(previous, current).filter((e) => e.type === 'achievement');
    expect(achievements).toHaveLength(1);
    expect(achievements[0].dedupeKey).toBe('achievement:62017');
  });

  it('announces newly unlocked titles', () => {
    const previous = baseState({ titles: [] });
    const current = baseState({ titles: [{ id: 1, name: 'the Explorer' }] });

    const titles = detectEvents(previous, current).filter((e) => e.type === 'title');
    expect(titles).toHaveLength(1);
    expect(titles[0].data.name).toBe('the Explorer');
  });

  it('announces item level only when it climbs by the step or more', () => {
    expect(
      detectEvents(
        baseState({ equippedItemLevel: 18 }),
        baseState({ equippedItemLevel: 20 }),
      ).filter((e) => e.type === 'item-level'),
    ).toHaveLength(0); // +2 < step(3)
    const jumped = detectEvents(
      baseState({ equippedItemLevel: 18 }),
      baseState({ equippedItemLevel: 22 }),
    ).filter((e) => e.type === 'item-level');
    expect(jumped).toHaveLength(1); // +4 >= step
    expect(jumped[0].data.to).toBe(22);
  });

  it('announces the first epic once', () => {
    const events = detectEvents(baseState({ epicCount: 0 }), baseState({ epicCount: 1 }));
    expect(events.filter((e) => e.type === 'first-epic')).toHaveLength(1);
    // Going 1 -> 2 epics is not a "first".
    expect(
      detectEvents(baseState({ epicCount: 1 }), baseState({ epicCount: 2 })).filter(
        (e) => e.type === 'first-epic',
      ),
    ).toHaveLength(0);
  });

  it('announces a spec change', () => {
    const events = detectEvents(
      baseState({ activeSpec: { id: 574, name: 'Balance', spentPoints: 10 } }),
      baseState({ activeSpec: { id: 134, name: 'Feral Combat', spentPoints: 10 } }),
    ).filter((e) => e.type === 'spec-change');
    expect(events).toHaveLength(1);
    expect(events[0].data).toMatchObject({ from: 'Balance', to: 'Feral Combat' });
  });

  it('detects joining, leaving and switching guilds', () => {
    const joined = detectEvents(baseState({ guild: undefined }), baseState({ guild: 'The Horde' }));
    expect(joined.find((e) => e.type === 'guild-change')?.data).toMatchObject({ to: 'The Horde' });

    const left = detectEvents(baseState({ guild: 'The Horde' }), baseState({ guild: undefined }));
    expect(left.find((e) => e.type === 'guild-change')?.data).toMatchObject({ from: 'The Horde' });
  });

  it('announces death milestones every 10 crossed', () => {
    const events = detectEvents(
      baseState({ totalDeaths: 8 }),
      baseState({ totalDeaths: 23 }),
    ).filter((e) => e.type === 'deaths');
    expect(events.map((e) => e.data.count)).toEqual([10, 20]);
  });

  it('announces every new falling death', () => {
    const events = detectEvents(
      baseState({ fallingDeaths: 1 }),
      baseState({ fallingDeaths: 2 }),
    ).filter((e) => e.type === 'falling-death');
    expect(events).toHaveLength(1);
    expect(events[0].data.count).toBe(2);
  });

  it('announces quest milestones every 100 crossed', () => {
    const events = detectEvents(
      baseState({ questsCompleted: 95 }),
      baseState({ questsCompleted: 242 }),
    ).filter((e) => e.type === 'quests');
    expect(events.map((e) => e.data.count)).toEqual([100, 200]);
  });
});

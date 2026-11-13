import { describe, expect, it } from 'vitest';

import type { DetectedEvent } from '../src/events/detect';
import { renderLine, renderRecapLines } from '../src/events/messages';

const levelUp = (level: number): DetectedEvent => ({
  type: 'level-up',
  dedupeKey: `level-up:${level}`,
  data: { level, isCap: level === 60 },
});

const profession = (): DetectedEvent => ({
  type: 'profession-tier',
  dedupeKey: 'profession-tier:165:Journeyman',
  data: { profession: 'Leatherworking', rank: 'Journeyman' },
});

const achievement = (name: string): DetectedEvent => ({
  type: 'achievement',
  dedupeKey: `achievement:${name}`,
  data: { name },
});

describe('renderLine', () => {
  it('never leaks the character name into the line', () => {
    const line = renderLine(levelUp(29));
    expect(line).not.toContain('{');
    expect(line).toMatch(/level 29/i);
  });

  it('fills profession rank and name', () => {
    const line = renderLine(profession());
    expect(line).toContain('Leatherworking');
    expect(line).toContain('Journeyman');
  });
});

describe('renderRecapLines', () => {
  it('collapses consecutive level-ups into a single range line', () => {
    const lines = renderRecapLines([levelUp(28), levelUp(29)]);
    const levelLines = lines.filter((l) => /\b28\b/.test(l) || /\bto 29\b/.test(l));
    // Both levels referenced, but only one level line.
    expect(levelLines).toHaveLength(1);
    expect(lines[0]).toMatch(/28/);
    expect(lines[0]).toMatch(/29/);
  });

  it('keeps a single level-up as its own line', () => {
    const lines = renderRecapLines([levelUp(29)]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/level 29/i);
  });

  it('special-cases reaching level 60 in a range', () => {
    const lines = renderRecapLines([levelUp(59), levelUp(60)]);
    expect(lines[0]).toMatch(/60/);
    expect(lines[0].toLowerCase()).toContain('cap');
  });

  it('renders one line per non-level event alongside the level line', () => {
    const lines = renderRecapLines([
      levelUp(28),
      levelUp(29),
      profession(),
      achievement('Novice Druid'),
    ]);
    // 1 grouped level line + profession + achievement = 3.
    expect(lines).toHaveLength(3);
    expect(lines.some((l) => l.includes('Leatherworking'))).toBe(true);
    expect(lines.some((l) => l.includes('Novice Druid'))).toBe(true);
  });
});

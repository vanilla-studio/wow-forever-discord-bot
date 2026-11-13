import type { DetectedEvent, EventType } from './detect';

// Per-event accent colors for the embed's left bar. When a recap mixes several
// event types we pick the "highest-value" one so the color reflects the
// headline moment.
const COLORS: Record<EventType, number> = {
  'first-epic': 0xa335ee, // epic purple — the showstopper
  'level-up': 0xf59e0b, // amber
  title: 0xa855f7, // purple
  achievement: 0xeab308, // gold
  'profession-tier': 0x3b82f6, // blue
  'item-level': 0x22c55e, // green
  'spec-change': 0x06b6d4, // cyan
  'guild-change': 0x14b8a6, // teal
  deaths: 0x6b7280, // gray (tombstone)
  'falling-death': 0x6b7280, // gray
  quests: 0xd97706, // dark amber
};

// Priority when a single recap contains multiple event types. First-epic wins.
const PRIORITY: EventType[] = [
  'first-epic',
  'level-up',
  'title',
  'achievement',
  'profession-tier',
  'spec-change',
  'guild-change',
  'item-level',
  'quests',
  'deaths',
  'falling-death',
];

export function recapColor(events: DetectedEvent[]): number {
  for (const type of PRIORITY) {
    if (events.some((e) => e.type === type)) {
      return COLORS[type];
    }
  }
  return COLORS['level-up'];
}

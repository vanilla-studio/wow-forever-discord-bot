import type { DetectedEvent } from './detect';

// Per-event accent colors for the embed's left bar. When a recap mixes several
// event types we pick the "highest-value" one so the color reflects the
// headline moment.
const COLORS = {
  'level-up': 0xf59e0b, // amber
  'profession-tier': 0x3b82f6, // blue
  achievement: 0xeab308, // gold
  title: 0xa855f7, // purple
  'item-level': 0x22c55e, // green
} as const;

// Priority when a single recap contains multiple event types.
const PRIORITY: Array<keyof typeof COLORS> = [
  'level-up',
  'title',
  'achievement',
  'profession-tier',
  'item-level',
];

export function recapColor(events: DetectedEvent[]): number {
  for (const type of PRIORITY) {
    if (events.some((e) => e.type === type)) {
      return COLORS[type];
    }
  }
  return COLORS['level-up'];
}

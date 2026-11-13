// Shared embed accent colors used across webhook recaps and command replies.
export const Colors = {
  success: 0x3ba55d, // green
  info: 0x3b6fb0, // blue
  denied: 0xe67e22, // amber
  error: 0xed4245, // red
  allianceBlue: 0x3b6fb0,
  hordeRed: 0xb03a2e,
} as const;

/** Faction-tinted color for a character card. */
export function factionColor(faction: string): number {
  return faction.toUpperCase() === 'HORDE' ? Colors.hordeRed : Colors.allianceBlue;
}

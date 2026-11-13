// Minimal Discord interaction typings — only the fields we read.

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
} as const;

// Application command option type for a sub-command.
const SUB_COMMAND = 1;

// Message flag: only the invoking user sees the reply.
export const EPHEMERAL = 1 << 6;

// Discord permission bit for server administrators.
export const ADMINISTRATOR = 1n << 3n;

export interface InteractionOption {
  name: string;
  type: number;
  // Present on leaf options (STRING, etc.).
  value?: string;
  // Present on SUB_COMMAND options.
  options?: InteractionOption[];
}

export interface Interaction {
  type: number;
  data?: {
    name: string;
    options?: InteractionOption[];
  };
  // Present for guild interactions.
  member?: {
    user: { id: string; username: string };
    permissions: string;
  };
  // Present for DM interactions.
  user?: { id: string; username: string };
  guild_id?: string;
}

/** The Discord user id of whoever triggered the interaction. */
export function invokerId(interaction: Interaction): string | undefined {
  return interaction.member?.user.id ?? interaction.user?.id;
}

/** True when the invoking member has the Administrator permission. */
export function isAdmin(interaction: Interaction): boolean {
  const perms = interaction.member?.permissions;
  if (!perms) {
    return false;
  }
  try {
    return (BigInt(perms) & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}

/** The invoked sub-command name (e.g. "follow" for `/wow-forever follow`). */
export function getSubcommand(interaction: Interaction): string | undefined {
  const sub = interaction.data?.options?.find((o) => o.type === SUB_COMMAND);
  return sub?.name;
}

/** Reads a string option by name from within the invoked sub-command. */
export function getOption(interaction: Interaction, name: string): string | undefined {
  const sub = interaction.data?.options?.find((o) => o.type === SUB_COMMAND);
  return sub?.options?.find((o) => o.name === name)?.value;
}

/** Builds an ephemeral text response (only the caller sees it). */
export function ephemeralReply(content: string) {
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL },
  });
}

/** Builds a public text response (everyone in the channel sees it). */
export function publicReply(content: string) {
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content },
  });
}

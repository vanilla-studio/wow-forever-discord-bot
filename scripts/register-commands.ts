// Registers the slash commands with Discord as guild commands (they appear
// instantly in the configured server). Run with:
//   node --env-file=.dev.vars scripts/register-commands.ts
//
// Reads DISCORD_APP_ID, DISCORD_APP_TOKEN and DISCORD_GUILD_ID from the env.

export {};

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_APP_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!APP_ID || !BOT_TOKEN || !GUILD_ID) {
  console.error(
    'Missing env. Need DISCORD_APP_ID, DISCORD_APP_TOKEN and DISCORD_GUILD_ID.\n' +
      'Run: node --env-file=.dev.vars scripts/register-commands.ts',
  );
  process.exit(1);
}

// Discord application command option types.
const SUB_COMMAND = 1;
const STRING = 3;

const characterOption = {
  name: 'character',
  description: 'Character slug, e.g. raekwon-rosebrook',
  type: STRING,
  required: true,
};

// A single namespaced command with sub-commands:
//   /wow-forever follow|unfollow|list|check
const commands = [
  {
    name: 'wow-forever',
    description: 'Track WoW Forever characters.',
    options: [
      {
        name: 'follow',
        description: 'Start following a character (name-surname).',
        type: SUB_COMMAND,
        options: [characterOption],
      },
      {
        name: 'unfollow',
        description: 'Stop following a character (owner or admin only).',
        type: SUB_COMMAND,
        options: [characterOption],
      },
      {
        name: 'list',
        description: 'List the followed characters (admins only).',
        type: SUB_COMMAND,
      },
      {
        name: 'check',
        description: 'Show a character current status right now.',
        type: SUB_COMMAND,
        options: [characterOption],
      },
    ],
  },
];

const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`;

const res = await fetch(url, {
  method: 'PUT',
  headers: {
    authorization: `Bot ${BOT_TOKEN}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error(`Failed to register commands: ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const registered = (await res.json()) as Array<{ name: string }>;
console.log(`Registered ${registered.length} command(s) in guild ${GUILD_ID}:`);
for (const cmd of registered) {
  console.log(`  /${cmd.name}`);
}

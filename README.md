# wow-forever-discord-bot

A Cloudflare Worker that watches a set of **WoW Forever** characters on the
Blizzard Armory and posts goliardic progress updates to a Discord channel.

Every hour it fetches each followed character, diffs the new state against the
last snapshot, and announces what changed:

- **Level up** — every single level (with a special shout at level 60).
- **Profession rank up** — when a profession reaches a new Classic rank
  (Apprentice → Journeyman → Expert → Artisan → Master).
- **New achievements**.
- **New titles**.

The first time a character is seen, the run only records a baseline — it does
not announce the whole backlog.

## Stack

- **Cloudflare Worker** (TypeScript), hourly **Cron Trigger**
- **D1** (SQLite) via **Prisma ORM** (`@prisma/adapter-d1`) for snapshots,
  events and token cache
- **Blizzard Battle.net API** (`profile-forever-<region>` namespace)
- **Discord webhook** for publishing (the interactive bot comes later)
- **Biome** (lint/format) + **Vitest** (tests)

## Project layout

```
src/
  index.ts            Worker entry: scheduled() cron + fetch() (/health, /sync)
  sync.ts             Orchestrates one sweep: fetch → diff → announce → persist
  types.ts            Env bindings
  blizzard/
    auth.ts           OAuth client-credentials token, cached in D1
    client.ts         Fetches profile + sub-endpoints
    normalize.ts      Collapses API responses into compact, diffable shapes
    types.ts          Response typings
  db/
    client.ts         Prisma client bound to the D1 adapter
  discord/
    webhook.ts        Posts embeds
  events/
    detect.ts         Diffs two snapshots into a list of events
    messages.ts       Goliardic English one-liners per event type
  generated/          Prisma client (gitignored, regenerated on install)
prisma/
  schema.prisma       Models: Character, Snapshot, Event, OauthToken
  migrations/         SQL migrations applied via Wrangler
  seed.sql            Characters to follow during local testing
```

## Secrets

The Worker needs three secrets (plus an optional one):

| Name                       | What                                          |
| -------------------------- | --------------------------------------------- |
| `BATTLE_NET_CLIENT_ID`     | Blizzard API client id                        |
| `BATTLE_NET_CLIENT_SECRET` | Blizzard API client secret                    |
| `DISCORD_WEBHOOK`          | Discord channel webhook URL                   |
| `SYNC_TOKEN` (optional)    | Bearer token guarding the manual `/sync` call |

Create a Blizzard API client at <https://develop.battle.net/> (client
credentials flow — no redirect URL needed).

## Local development

```bash
npm install   # also runs `prisma generate` via postinstall

# Secrets for `wrangler dev` (key=value, one per line).
cp .dev.vars.example .dev.vars   # then fill in the values

# DATABASE_URL for the Prisma CLI (local throwaway SQLite, not a secret).
cp .env.example .env

# Apply the SQL migration to the local D1 and seed the followed characters.
npm run db:migrate:local
npm run db:seed:local

# Run the Worker locally.
npm run dev
```

Then trigger a sweep by hand:

```bash
curl http://localhost:8787/health
curl -X POST http://localhost:8787/sync
```

The first `/sync` records a baseline (announces nothing). Subsequent sweeps
announce anything that changed since the last snapshot.

### Useful commands

```bash
npm run lint              # Biome check
npm run format            # Biome format --write
npm run test              # Vitest
npm run prisma:generate   # Regenerate the Prisma client from schema.prisma
npm run db:studio         # Open Prisma Studio
```

### Evolving the schema

Save a copy of the current schema *before* editing, then diff the copy against
the edited schema to produce the next migration, and apply it:

```bash
cp prisma/schema.prisma /tmp/before.prisma
# ...edit prisma/schema.prisma...
npm run prisma:generate
npx prisma migrate diff \
  --from-schema /tmp/before.prisma \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/0002_describe_change.sql
npm run db:migrate:local    # then db:migrate:remote when deploying
```

## CI / Deploy

Two workflows split the work:

- **CI** (`.github/workflows/ci.yml`) — the quality gate. Lint + typecheck +
  test on feature branches and on PRs into `main`.
- **Deploy** (`.github/workflows/deploy.yml`) — on push to `main`, applies
  pending D1 migrations remotely and deploys the Worker. No repeated checks:
  it trusts what CI already validated.

> **Protect `main`** in GitHub (Settings → Branches → branch protection rule)
> and require the CI check to pass before merging. That is what makes the Deploy
> workflow safe to skip the checks — it is a repository setting, not a file.

### One-time setup

```bash
# 1. Create the remote D1 and paste its id into wrangler.jsonc (database_id).
npx wrangler d1 create wow-forever-bot-db

# 2. Set the Worker runtime secrets (stored on Cloudflare, not in git).
npx wrangler secret put BATTLE_NET_CLIENT_ID
npx wrangler secret put BATTLE_NET_CLIENT_SECRET
npx wrangler secret put DISCORD_WEBHOOK
```

Then add two **GitHub repository secrets** so the Action can deploy:

| GitHub secret           | Where to get it                                   |
| ----------------------- | ------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare dashboard → My Profile → API Tokens    |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → overview |

After that, every push to `main` deploys automatically. To deploy by hand:

```bash
npm run db:migrate:remote
npm run deploy
```

## Notes on the Forever API

- Characters are **realmless**; the slug is `{name}-{surname}` lowercased
  (e.g. `raekwon-rosebrook`).
- A character only appears from **level 10, after logging out**; before that
  the profile 404s. The sync treats a 404 as "skip, try next hour".
- `character-media` (the avatar/render) can lag hours behind the profile.

## Roadmap

- [ ] Interactive Discord bot (slash commands `/follow`, `/unfollow`, `/list`)
      writing into the same `characters` table.
- [ ] Per-character announcement language (each owner picks their language).
- [ ] More event types: new epic gear, first raid/dungeon boss kills, spec
      changes.

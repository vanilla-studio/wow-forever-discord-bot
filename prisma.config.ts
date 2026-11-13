import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Only used by the Prisma CLI for `migrate diff` (set via .env locally).
    // `prisma generate` doesn't need it, so we fall back to a dummy URL to keep
    // `postinstall` working in CI/deploy where DATABASE_URL isn't set.
    url: process.env.DATABASE_URL ?? 'file:./prisma/db.sqlite',
  },
});

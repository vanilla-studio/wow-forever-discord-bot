import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Only used by the Prisma CLI for `migrate diff`; the Worker talks to D1
    // through the @prisma/adapter-d1 binding, not this URL.
    url: env('DATABASE_URL'),
  },
});

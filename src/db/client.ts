import { PrismaD1 } from '@prisma/adapter-d1';

import { PrismaClient } from '../generated/prisma/client';

/** Creates a Prisma client bound to the Worker's D1 database binding. */
export function createPrisma(d1: D1Database): PrismaClient {
  const adapter = new PrismaD1(d1);
  return new PrismaClient({ adapter });
}

export type Db = PrismaClient;

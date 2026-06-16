import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export * from './schema.js';

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Database = ReturnType<typeof createDb>['db'];

// Test/e2e database backed by an in-memory PGlite instance. PGlite and its
// drizzle adapter are imported lazily so they stay out of the production path.
// Returns the same { db, pool } shape as createDb so callers can stay agnostic;
// pool.end() closes the underlying client.
export async function createPgliteDb(): Promise<{
  db: Database;
  pool: { end: () => Promise<void> };
}> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');

  const client = new PGlite();
  const db = drizzlePglite(client, { schema });

  const here = dirname(fileURLToPath(import.meta.url));
  // src/index.ts (dev/tsx) and dist/index.js (build) both sit one level under
  // the package root, where the generated drizzle migrations live.
  const migrationsFolder = resolve(here, '..', 'drizzle');
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder });

  return {
    db: db as unknown as Database,
    pool: { end: () => client.close() },
  };
}

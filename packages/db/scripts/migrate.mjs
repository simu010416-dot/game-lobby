import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const MIGRATIONS = [
  {
    tag: '0000_faithful_nomad',
    hash: '7c984026ae3484560e2ca4d40745e67266be165c65555c7896371c8da4162914',
    createdAt: 1781514269027,
  },
  {
    tag: '0001_game_type_lobby',
    hash: 'c0f0f3edef84c42b215a67dccd0cca196743d03a9e016787960db90fdaa8f494',
    createdAt: 1781600000000,
  },
];

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const repoRoot = path.resolve(pkgRoot, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Add it to the repo root .env file.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);
const migrationsFolder = path.join(pkgRoot, 'drizzle');

async function tableExists(tableName) {
  const res = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return res.rowCount > 0;
}

async function columnExists(tableName, columnName) {
  const res = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName],
  );
  return res.rowCount > 0;
}

async function getAppliedMigrationHashes() {
  const hasDrizzleSchema = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'`,
  );
  if (!hasDrizzleSchema.rowCount) return new Set();

  const res = await pool.query('SELECT hash FROM drizzle.__drizzle_migrations');
  return new Set(res.rows.map((row) => row.hash));
}

async function ensureMigrationsTable() {
  await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
}

async function recordMigration(entry) {
  await pool.query(
    'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
    [entry.hash, entry.createdAt],
  );
  console.log(`Baselined migration ${entry.tag}`);
}

async function baselineExistingDatabase() {
  const applied = await getAppliedMigrationHashes();
  if (applied.size > 0) return;

  const hasRooms = await tableExists('rooms');
  if (!hasRooms) return;

  console.log('Detected existing schema without migration history (likely from db:push).');
  await ensureMigrationsTable();

  const hasGameType = await columnExists('rooms', 'game_type');
  const toBaseline = hasGameType ? MIGRATIONS : [MIGRATIONS[0]];

  for (const entry of toBaseline) {
    if (!applied.has(entry.hash)) {
      await recordMigration(entry);
      applied.add(entry.hash);
    }
  }
}

try {
  await baselineExistingDatabase();
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied successfully.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

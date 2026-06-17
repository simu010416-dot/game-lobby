import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(pkgRoot, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/game_lobby',
  },
});

import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
const url = process.env.MIGRATION_DATABASE_URL ?? '';
if (
  process.env.DEMO_MODE !== 'true' ||
  !/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(url)
)
  throw new Error('Seed permitido somente em banco local com DEMO_MODE=true.');
const pool = new Pool({ connectionString: url });
try {
  await pool.query(await readFile(new URL('./seed.sql', import.meta.url), 'utf8'));
  console.log('Seed sintético: duas organizações, três empresas, quatro perfis.');
} finally {
  await pool.end();
}

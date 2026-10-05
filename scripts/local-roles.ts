import { Pool } from 'pg';
const url = process.env.MIGRATION_DATABASE_URL ?? '';
if (!/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(url))
  throw new Error('Este script é exclusivo para localhost.');
const pool = new Pool({ connectionString: url });
try {
  await pool.query(
    "ALTER ROLE concloud_runtime LOGIN PASSWORD 'local_dev_only'; ALTER ROLE concloud_dispatcher LOGIN PASSWORD 'local_dispatcher_only';",
  );
  console.log('Credenciais locais de runtime configuradas.');
} finally {
  await pool.end();
}

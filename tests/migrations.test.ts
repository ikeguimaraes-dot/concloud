import 'dotenv/config';
import { it, expect } from 'vitest';
import { Pool } from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const local = /^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(
  process.env.MIGRATION_DATABASE_URL ?? '',
);
it.skipIf(!local)(
  'Prisma deploy reproduzível preserva schema público existente e isola seu histórico',
  async () => {
    const admin = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
    const name = `concloud_migrations_${Date.now()}`;
    await admin.query(`CREATE DATABASE ${name}`);
    const url = new URL(process.env.MIGRATION_DATABASE_URL!);
    url.pathname = '/' + name;
    const db = new Pool({ connectionString: url.toString() });
    try {
      await db.query(
        'CREATE TABLE public.other_system(id int primary key); INSERT INTO public.other_system VALUES(42)',
      );
      const env = { ...process.env, MIGRATION_DATABASE_URL: url.toString() };
      await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
        env,
      });
      await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
        env,
      });
      expect((await db.query('SELECT id FROM public.other_system')).rows).toEqual([{ id: 42 }]);
      expect(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM concloud._prisma_migrations WHERE finished_at IS NOT NULL',
          )
        ).rows[0].n,
      ).toBe(5);
      expect(
        (
          await db.query(
            "SELECT table_schema FROM information_schema.tables WHERE table_name='_prisma_migrations'",
          )
        ).rows,
      ).toEqual([{ table_schema: 'concloud' }]);
    } finally {
      await db.end();
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await admin.end();
    }
  },
  30000,
);

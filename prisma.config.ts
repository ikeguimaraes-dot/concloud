import 'dotenv/config';
import { defineConfig } from 'prisma/config';
const migrationUrl = new URL(
  process.env.MIGRATION_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres',
);
migrationUrl.searchParams.set('schema', 'concloud');
export default defineConfig({
  schema: 'packages/database/schema.prisma',
  migrations: { path: 'packages/database/migrations', seed: 'tsx packages/database/seed.ts' },
  datasource: { url: migrationUrl.toString() },
});

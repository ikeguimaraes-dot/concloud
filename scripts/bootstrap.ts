import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
const userId = process.env.BOOTSTRAP_USER_ID;
if (!userId || !process.env.MIGRATION_DATABASE_URL)
  throw new Error(
    'Defina BOOTSTRAP_USER_ID de um usuário Supabase já confirmado e MIGRATION_DATABASE_URL.',
  );
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const { data, error } = await client.auth.admin.getUserById(userId);
if (error || !data.user.email || !data.user.email_confirmed_at)
  throw new Error('Identidade confirmada não encontrada.');
const db = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
const cx = await db.connect();
try {
  await cx.query('BEGIN');
  await cx.query("SELECT pg_advisory_xact_lock(hashtext('concloud:bootstrap'))");
  const exists = await cx.query(
    "SELECT 1 FROM concloud.\"OrganizationMembership\" WHERE role IN ('ORG_ADMIN','SUPER_ADMIN') LIMIT 1",
  );
  if (exists.rowCount)
    throw new Error(
      'Administrador inicial já existe. Use processo administrativo auditado para novos administradores.',
    );
  const org = randomUUID();
  await cx.query(
    'INSERT INTO concloud."Profile" (id,email,name) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING',
    [userId, data.user.email, data.user.email.split('@')[0]],
  );
  await cx.query('INSERT INTO concloud."Organization" (id,name) VALUES ($1,$2)', [
    org,
    process.env.BOOTSTRAP_ORG_NAME ?? 'ConCloud',
  ]);
  await cx.query(
    'INSERT INTO concloud."OrganizationMembership" (id,"organizationId","userId",role) VALUES ($1,$2,$3,\'ORG_ADMIN\')',
    [randomUUID(), org, userId],
  );
  await cx.query('COMMIT');
  console.log('Administrador inicial vinculado. Ative MFA antes de operar.');
} catch (e) {
  await cx.query('ROLLBACK');
  throw e;
} finally {
  cx.release();
  await db.end();
}

import { beforeAll, afterAll, it, expect, describe } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
let db: PGlite;
const client = '10000000-0000-4000-8000-000000000003',
  admin = '10000000-0000-4000-8000-000000000001';
const org = '20000000-0000-4000-8000-000000000001',
  company = '30000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    await readFile('packages/database/migrations/20261005120000_initial/migration.sql', 'utf8'),
  );
  await db.exec(
    await readFile('packages/database/migrations/20261005120100_dispatcher/migration.sql', 'utf8'),
  );
  await db.exec(
    await readFile('packages/database/migrations/20261005120200_integrity/migration.sql', 'utf8'),
  );
  await db.exec(
    await readFile(
      'packages/database/migrations/20261005120300_client_revision/migration.sql',
      'utf8',
    ),
  );
  await db.exec(
    await readFile('packages/database/migrations/20261005120400_team_labels/migration.sql', 'utf8'),
  );
  await db.exec(await readFile('packages/database/seed.sql', 'utf8'));
});
afterAll(async () => db?.close());
async function asUser<T>(user: string, fn: () => Promise<T>) {
  await db.exec('BEGIN; SET LOCAL ROLE concloud_runtime;');
  await db.query("SELECT set_config('app.user_id',$1,true)", [user]);
  try {
    const result = await fn();
    await db.exec('COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}
describe('RLS real PostgreSQL embutido', () => {
  it('cliente vê apenas a empresa atribuída, não outra da organização nem outro tenant', async () => {
    const result = await asUser(client, () => db.query('SELECT id FROM concloud."Company"'));
    expect(result.rows).toEqual([{ id: company }]);
  });
  it('admin fica restrito à sua organização', async () => {
    const result = await asUser(admin, () => db.query('SELECT id FROM concloud."Company"'));
    expect(result.rows).toHaveLength(2);
  });
  it('contexto local não vaza entre transações', async () => {
    await asUser(client, () => db.query('SELECT 1'));
    await db.exec('SET ROLE concloud_runtime');
    expect((await db.query('SELECT id FROM concloud."Company"')).rows).toHaveLength(0);
    await db.exec('RESET ROLE');
  });
  it('recusa escrita financeira cruzada', async () => {
    await expect(
      asUser(client, () =>
        db.query(
          'INSERT INTO concloud."Contact" (id,"organizationId","companyId",name,kind) VALUES (gen_random_uuid(),$1,$2,\'Intruso\',\'CUSTOMER\')',
          [org, '30000000-0000-4000-8000-000000000002'],
        ),
      ),
    ).rejects.toThrow();
  });
  it('constraints impedem vincular conta de outro tenant mesmo com admin de infraestrutura', async () => {
    await expect(
      db.query(
        'INSERT INTO concloud."Transfer" (id,"organizationId","companyId","sourceId","targetId",amount,date,"idempotencyKey") VALUES (gen_random_uuid(),$1,$2,$3,$4,10,current_date,\'cross\')',
        [
          org,
          '30000000-0000-4000-8000-000000000002',
          '40000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000002',
        ],
      ),
    ).rejects.toThrow();
  });
  it('nega escalada de papel no banco', async () => {
    await expect(
      asUser(client, () =>
        db.query(
          'INSERT INTO concloud."OrganizationMembership" (id,"organizationId","userId",role) VALUES(gen_random_uuid(),$1,$2,\'ORG_ADMIN\')',
          [org, client],
        ),
      ),
    ).rejects.toThrow();
  });
  it('auditoria é append-only para runtime', async () => {
    await asUser(client, () =>
      db.query(
        'INSERT INTO concloud."AuditEvent" (id,"organizationId","companyId","actorId",action,"resourceId","correlationId",metadata) VALUES(gen_random_uuid(),$1,$2,$3,\'test\',\'test\',\'correlation\',\'{}\')',
        [org, company, client],
      ),
    );
    await expect(
      asUser(client, () => db.query('UPDATE concloud."AuditEvent" SET action=\'tampered\'')),
    ).rejects.toThrow();
    await expect(
      asUser(client, () => db.query('DELETE FROM concloud."AuditEvent"')),
    ).rejects.toThrow();
  });
  it('documentos internos e de outras empresas ficam invisíveis', async () => {
    await db.query(
      'INSERT INTO concloud."Document" (id,"organizationId","companyId",title,competence,classification,"uploadedBy") VALUES(gen_random_uuid(),$1,$2,\'Interno\',\'2026-10\',\'RESULT\',$3)',
      [org, company, admin],
    );
    expect(
      (await asUser(client, () => db.query('SELECT * FROM concloud."Document"'))).rows,
    ).toHaveLength(0);
  });
  it('cliente não pode aprovar revisão', async () => {
    await expect(
      asUser(client, () =>
        db.query(
          'INSERT INTO concloud."Review" (id,"organizationId","companyId","periodId","exportBatchId","reviewerId",approved,notes) VALUES(gen_random_uuid(),$1,$2,gen_random_uuid(),gen_random_uuid(),$3,true,\'indevida\')',
          [org, company, client],
        ),
      ),
    ).rejects.toThrow();
  });
});

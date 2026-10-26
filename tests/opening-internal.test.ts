import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { beforeAll, afterAll, it, expect } from 'vitest';
let db: PGlite;
const admin = '10000000-0000-4000-8000-000000000001',
  staff = '10000000-0000-4000-8000-000000000002',
  client = '10000000-0000-4000-8000-000000000003';
let org: string, lead: string;
beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated;');
  for (const name of (await readdir('packages/database/migrations'))
    .filter((n) => /^\d/.test(n))
    .sort())
    await db.exec(await readFile(`packages/database/migrations/${name}/migration.sql`, 'utf8'));
  org = (await db.query<{ id: string }>('select concloud.opening_office() as id')).rows[0].id;
  for (const [id, role] of [
    [admin, 'ORG_ADMIN'],
    [staff, 'ASSISTANT'],
    [client, 'CLIENT_OWNER'],
  ]) {
    await db.query('insert into concloud."Profile"(id,email,name) values($1,$2,$3)', [
      id,
      `${id}@example.invalid`,
      'Teste',
    ]);
    await db.query(
      'insert into concloud."OrganizationMembership"(id,"organizationId","userId",role) values(gen_random_uuid(),$1,$2,$3::concloud."Role")',
      [org, id, role],
    );
  }
  await db.query(
    'insert into concloud."OpeningStaff"("organizationId","userId","displayName",documents) values($1,$2,\'Admin\',true),($1,$3,\'Operador\',false)',
    [org, admin, staff],
  );
  lead = (
    await db.query<{ id: string }>(
      'select concloud.save_opening_lead_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as id',
      [
        'a'.repeat(64),
        'Sintetico',
        '00000000000',
        'teste@example.invalid',
        '000000000',
        2,
        '',
        '',
        '',
        '',
        '',
        '',
        false,
      ],
    )
  ).rows[0].id;
});
afterAll(async () => db?.close());
async function asUser<T>(id: string, fn: () => Promise<T>, aal = 'aal2') {
  await db.exec('begin; set local role concloud_runtime;');
  await db.query("select set_config('app.user_id',$1,true),set_config('app.aal',$2,true)", [
    id,
    aal,
  ]);
  try {
    const result = await fn();
    await db.exec('commit');
    return result;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
it('persiste draft com cadeia inteira, inclusive MEI, sem inventar sócios', async () => {
  const rows = await db.query<{ status: string; partners: unknown[] }>(
    'select status,partners from concloud."OpeningLead" where id=$1',
    [lead],
  );
  expect(rows.rows[0]).toEqual({ status: 'DRAFT', partners: [] });
  await db.query('update concloud."OpeningLead" set plan=\'mei\' where id=$1', [lead]);
});
it('admin AAL2 vê draft; cliente e AAL1 não', async () => {
  expect(
    (await asUser(admin, () => db.query('select id from concloud."OpeningLead"'))).rows,
  ).toHaveLength(1);
  expect(
    (await asUser(client, () => db.query('select id from concloud."OpeningLead"'))).rows,
  ).toHaveLength(0);
  expect(
    (await asUser(admin, () => db.query('select id from concloud."OpeningLead"'), 'aal1')).rows,
  ).toHaveLength(0);
});
it('operador só vê atribuído e não altera pagamento; atribuição tem versão', async () => {
  expect(
    (await asUser(staff, () => db.query('select id from concloud."OpeningLead"'))).rows,
  ).toHaveLength(0);
  const assign = () =>
    asUser(admin, () =>
      db.query(
        'update concloud."OpeningLead" set "ownerId"=$1,version=version+1 where id=$2 and version=1 returning version',
        [staff, lead],
      ),
    );
  expect((await assign()).rows).toEqual([{ version: 2 }]);
  expect((await assign()).rows).toEqual([]);
  expect(
    (await asUser(staff, () => db.query('select id from concloud."OpeningLead"'))).rows,
  ).toHaveLength(1);
  await expect(
    asUser(admin, () => db.query('update concloud."OpeningLead" set "paymentStatus"=\'PAID\'')),
  ).rejects.toThrow();
});
it('isola organização e nega troca de owner pelo operador', async () => {
  await db.exec(
    `insert into concloud."Organization"(id,name) values('20000000-0000-4000-8000-000000000099','Outro');`,
  );
  await db.query(
    "insert into concloud.\"OpeningLead\"(\"organizationId\",name,cpf,email,phone,status) values($1,'Outro','11111111111','outro@example.invalid','00000000','DRAFT')",
    ['20000000-0000-4000-8000-000000000099'],
  );
  expect(
    (await asUser(admin, () => db.query('select id from concloud."OpeningLead"'))).rows,
  ).toHaveLength(1);
  expect(
    (
      await asUser(staff, () =>
        db.query('update concloud."OpeningLead" set "ownerId"=null returning id'),
      )
    ).rows,
  ).toHaveLength(0);
});
it('auditoria append-only e documentos têm permissão independente', async () => {
  await db.query(
    "insert into concloud.\"OpeningLeadDocument\"(\"openingLeadId\",kind,filename,mime,size,bucket,\"objectKey\") values($1,'endereco-empresa','sintetico.pdf','application/pdf',20,'concloud-private',$2)",
    [lead, `opening-leads/${lead}/test`],
  );
  expect(
    (await asUser(admin, () => db.query('select id from concloud."OpeningLeadDocument"'))).rows,
  ).toHaveLength(1);
  expect(
    (await asUser(staff, () => db.query('select id from concloud."OpeningLeadDocument"'))).rows,
  ).toHaveLength(0);
  await asUser(admin, () =>
    db.query(
      'insert into concloud."OpeningAuditEvent"("organizationId","leadId","actorId",action) values($1,$2,$3,\'test\')',
      [org, lead, admin],
    ),
  );
  await expect(
    asUser(admin, () => db.query('delete from concloud."OpeningAuditEvent"')),
  ).rejects.toThrow();
});
it('revogação bloqueia acesso e remove elegibilidade de atribuição', async () => {
  await db.query('update concloud."OrganizationMembership" set active=false where "userId"=$1', [
    staff,
  ]);
  expect(
    (await asUser(staff, () => db.query('select id from concloud."OpeningLead"'))).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ active: boolean }>(
        'select active from concloud."OpeningStaff" where "userId"=$1',
        [staff],
      )
    ).rows[0].active,
  ).toBe(false);
});
it('preserva IDs e objetos privados legados ao aplicar sócios, MEI e painel', async () => {
  const legacy = new PGlite();
  try {
    await legacy.exec('create role anon;create role authenticated;');
    const names = (await readdir('packages/database/migrations'))
      .filter((n) => /^\d/.test(n))
      .sort();
    for (const name of names.filter((n) => n < '20261016120000'))
      await legacy.exec(
        await readFile(`packages/database/migrations/${name}/migration.sql`, 'utf8'),
      );
    const original = (
      await legacy.query<{ id: string }>(
        `insert into concloud."OpeningLead"(name,cpf,email,phone,status) values('Legado','22222222222','legado@example.invalid','000000000','DRAFT') returning id`,
      )
    ).rows[0].id;
    await legacy.query(
      `insert into concloud."OpeningLeadDocument"("openingLeadId",kind,filename,mime,size,bucket,"objectKey") values($1,'identidade','legado.pdf','application/pdf',20,'concloud-private','opening-leads/legacy-object')`,
      [original],
    );
    const before = (await legacy.query('select id,"objectKey" from concloud."OpeningLeadDocument"'))
      .rows;
    for (const name of names.filter((n) => n >= '20261016120000'))
      await legacy.exec(
        await readFile(`packages/database/migrations/${name}/migration.sql`, 'utf8'),
      );
    expect(
      (await legacy.query('select id,"objectKey" from concloud."OpeningLeadDocument"')).rows,
    ).toEqual(before);
    expect(
      (await legacy.query<{ kind: string }>('select kind from concloud."OpeningLeadDocument"'))
        .rows[0].kind,
    ).toBe('socio-1-identidade');
    expect(
      (await legacy.query<{ id: string }>('select id from concloud."OpeningLead"')).rows[0].id,
    ).toBe(original);
  } finally {
    await legacy.close();
  }
});

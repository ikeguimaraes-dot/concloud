import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { beforeAll, afterAll, it, expect } from 'vitest';
import type { Tx } from '@database/client';
import { operations } from '../apps/web/src/lib/internal-operations';
import { allowedTransition, requiredDocumentKinds } from '../apps/web/src/lib/opening-workflow';
let db: PGlite;
let lead: string, org: string, processId: string;
const actor = {
  id: '20000000-0000-4000-8000-000000000001',
  email: 'operator@example.invalid',
  aal: 'aal1',
};
const client = '20000000-0000-4000-8000-000000000002';
const staff = { documents: true, canAssign: true };
const tx = {
  $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.reduce((a, s, i) => a + (i ? `$${i}` : '') + s, '');
    return (await db.query(sql, values)).rows;
  },
  $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.reduce((a, s, i) => a + (i ? `$${i}` : '') + s, '');
    await db.query(sql, values);
    return 1;
  },
} as unknown as Tx;
async function asActor<T>(fn: () => Promise<T>, id = actor.id) {
  await db.exec('begin;set local role concloud_runtime;');
  await db.query("select set_config('app.user_id',$1,true),set_config('app.aal','aal1',true)", [
    id,
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
async function call(path: string[], body?: unknown, method = body ? 'POST' : 'GET') {
  return asActor(() =>
    operations(
      tx,
      actor,
      staff,
      new Request('https://example.invalid', {
        method,
        ...(body
          ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
          : {}),
      }),
      path,
    ),
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon;create role authenticated;');
  for (const name of (await readdir('packages/database/migrations'))
    .filter((n) => /^\d/.test(n))
    .sort())
    await db.exec(await readFile(`packages/database/migrations/${name}/migration.sql`, 'utf8'));
  org = (await db.query<{ id: string }>('select concloud.opening_office() as id')).rows[0].id;
  await db.query(
    "insert into concloud.\"Profile\"(id,email,name) values($1,$2,'Operator'),($3,'client@example.invalid','Client')",
    [actor.id, actor.email, client],
  );
  await db.query(
    'insert into concloud."OrganizationMembership"(id,"organizationId","userId",role) values(gen_random_uuid(),$1,$2,\'ORG_ADMIN\'),(gen_random_uuid(),$1,$3,\'CLIENT_OWNER\')',
    [org, actor.id, client],
  );
  await db.query(
    'insert into concloud."OpeningStaff"("organizationId","userId","displayName",documents,"canAssign") values($1,$2,\'Operator\',true,true)',
    [org, actor.id],
  );
  lead = (
    await db.query<{ id: string }>(
      'select concloud.save_opening_lead_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as id',
      [
        'b'.repeat(64),
        'Synthetic',
        '00000000000',
        'client@example.invalid',
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
  await db.query(
    'update concloud."OpeningLead" set plan=\'mei\',state=\'SP\',status=\'NEW\',"ownerId"=$2,"authUserId"=$3 where id=$1',
    [lead, actor.id, client],
  );
});
afterAll(async () => db?.close());
it('roteia MEI separado e preserva retornos previstos, sem pular etapas', () => {
  expect(requiredDocumentKinds(1, true)).toHaveLength(5);
  expect(requiredDocumentKinds(2, false)).toHaveLength(10);
  for (const [from, to] of [
    [4, 2],
    [6, 5],
    [8, 7],
    [10, 9],
    [13, 10],
  ])
    expect(allowedTransition('JUCESP', from, to)).toBe(true);
  expect(allowedTransition('JUCESP', 1, 3)).toBe(false);
  expect(allowedTransition('MEI', 7, 8)).toBe(false);
});
it('pagamento bloqueia entrada; criação é idempotente e isolada do cliente', async () => {
  await expect(call(['processes'], { leadId: lead, workflow: 'MEI' })).rejects.toMatchObject({
    status: 422,
  });
  await db.query('update concloud."OpeningLead" set "paymentStatus"=\'PAID\' where id=$1', [lead]);
  const p = (await call(['processes'], { leadId: lead, workflow: 'MEI' })) as { id: string };
  processId = p.id;
  expect(
    ((await call(['processes'], { leadId: lead, workflow: 'MEI' })) as { id: string }).id,
  ).toBe(processId);
  expect(
    (await asActor(() => db.query('select id from concloud."OpeningProcess"'), client)).rows,
  ).toHaveLength(0);
});
it('trava documentos, aceita revisões atuais e rejeita versão concorrente', async () => {
  const move = (targetStage: number, expectedVersion: number) =>
    call(['processes', processId, 'transitions'], {
      targetStage,
      expectedVersion,
      situation: 'IN_PROGRESS',
      reason: 'Conferência sintética concluída',
      checked: true,
    });
  await move(2, 1);
  await expect(move(3, 2)).rejects.toMatchObject({ code: 'BLOCKED' });
  for (const kind of requiredDocumentKinds(1, true)) {
    await db.query(
      'insert into concloud."OpeningLeadDocument"("openingLeadId",kind,filename,mime,size,bucket,"objectKey") values($1,$2,\'synthetic.pdf\',\'application/pdf\',12,\'concloud-private\',$3)',
      [lead, kind, `opening-leads/${lead}/${kind}/v1`],
    );
  }
  await db.query(
    'insert into concloud."OpeningDocumentReview"("versionId","reviewerId",decision) select id,$2,\'APPROVED\' from concloud."OpeningDocumentVersion" where "leadId"=$1',
    [lead, actor.id],
  );
  await move(3, 2);
  await expect(move(4, 2)).rejects.toMatchObject({ code: 'CONFLICT' });
  await move(2, 3);
  expect(
    (
      await db.query('select id from concloud."OpeningProcessEvent" where "processId"=$1', [
        processId,
      ])
    ).rows,
  ).toHaveLength(4);
  await expect(
    asActor(() => db.query('delete from concloud."OpeningProcessEvent"')),
  ).rejects.toThrow();
});
it('substituição preserva evidência anterior e não herda aprovação; cliente vê correção', async () => {
  await db.query(
    'update concloud."OpeningLeadDocument" set "objectKey"=$2,"uploadedAt"=now() where "openingLeadId"=$1 and kind=\'socio-1-identidade\'',
    [lead, `opening-leads/${lead}/socio-1-identidade/v2`],
  );
  expect(
    (
      await db.query(
        'select id from concloud."OpeningDocumentVersion" where "leadId"=$1 and kind=\'socio-1-identidade\'',
        [lead],
      )
    ).rows,
  ).toHaveLength(2);
  const rows = await db.query<{ kind: string; decision: string }>(
    'select * from concloud.get_opening_document_reviews($1,$2)',
    [lead, client],
  );
  expect(rows.rows.find((r) => r.kind === 'socio-1-identidade')?.decision).toBe('RECEIVED');
  await db.query(
    'insert into concloud."OpeningDocumentReview"("versionId","reviewerId",decision,reason) select id,$2,\'REJECTED\',\'Arquivo ilegível, envie novamente\' from concloud."OpeningDocumentVersion" where "leadId"=$1 and "objectKey" like \'%/v2\'',
    [lead, actor.id],
  );
  expect(
    (
      await db.query<{ reason: string }>(
        "select * from concloud.get_opening_document_reviews($1,$2) where decision='REJECTED'",
        [lead, client],
      )
    ).rows[0].reason,
  ).toContain('ilegível');
  expect(
    (await db.query('select * from concloud.get_opening_document_reviews($1,$2)', [lead, actor.id]))
      .rows,
  ).toHaveLength(0);
  await expect(
    call(['processes', processId, 'transitions'], {
      targetStage: 3,
      expectedVersion: 4,
      situation: 'IN_PROGRESS',
      reason: 'Tentativa com pendência',
      checked: true,
    }),
  ).rejects.toMatchObject({ code: 'BLOCKED' });
});
it('tarefas persistem com responsável, prazo e controle de versão', async () => {
  const task = (await call(['processes', processId, 'tasks'], {
    title: 'Conferir documento',
    dueAt: '2026-11-02T12:00:00.000Z',
  })) as { id: string; ownerId: string };
  expect(task.ownerId).toBe(actor.id);
  await call(
    ['processes', processId, 'tasks', task.id],
    { completed: true, expectedVersion: 1 },
    'PATCH',
  );
  await expect(
    call(
      ['processes', processId, 'tasks', task.id],
      { completed: false, expectedVersion: 1 },
      'PATCH',
    ),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
});

it('JUCESP exige DARE e contrato assinado antes do protocolo; retornos exigem referência', async () => {
  await db.query('update concloud."OpeningLead" set plan=\'essencial\' where id=$1', [lead]);
  await db.query(
    "insert into concloud.\"OpeningLeadDocument\"(\"openingLeadId\",kind,filename,mime,size,bucket,\"objectKey\") values($1,'iptu','synthetic.pdf','application/pdf',12,'concloud-private',$2)",
    [lead, `opening-leads/${lead}/iptu/v1`],
  );
  await db.query(
    'insert into concloud."OpeningDocumentReview"("versionId","reviewerId",decision) select v.id,$2,\'APPROVED\' from concloud."OpeningDocumentVersion" v join concloud."OpeningLeadDocument" d on d.id=v."documentId" and d."objectKey"=v."objectKey" where v."leadId"=$1',
    [lead, actor.id],
  );
  await db.query('update concloud."OpeningProcess" set workflow=\'JUCESP\',stage=11 where id=$1', [
    processId,
  ]);
  const input = {
    targetStage: 12,
    expectedVersion: 4,
    situation: 'IN_PROGRESS',
    reason: 'Assinaturas e pagamento conferidos',
    checked: true,
  };
  await expect(call(['processes', processId, 'transitions'], input)).rejects.toMatchObject({
    code: 'BLOCKED',
  });
  for (const kind of ['DARE', 'SIGNED_CONTRACT'])
    await db.query(
      'insert into concloud."OpeningProcessEvidence"("processId","actorId",kind,filename,mime,size,bucket,"objectKey") values($1,$2,$3,\'synthetic.pdf\',\'application/pdf\',12,\'concloud-private\',$4)',
      [processId, actor.id, kind, `opening-processes/${processId}/${kind}`],
    );
  await call(['processes', processId, 'transitions'], input);
  await db.query('update concloud."OpeningProcess" set stage=13 where id=$1', [processId]);
  await expect(
    call(['processes', processId, 'transitions'], {
      ...input,
      targetStage: 10,
      expectedVersion: 5,
    }),
  ).rejects.toMatchObject({ code: 'BLOCKED' });
  await call(['processes', processId, 'transitions'], {
    ...input,
    targetStage: 10,
    expectedVersion: 5,
    protocol: 'JUNTA-SINTETICO',
  });
});

it('assinatura anterior ao retorno não libera novo protocolo', async () => {
  await db.query('update concloud."OpeningProcess" set stage=11 where id=$1', [processId]);
  await expect(
    call(['processes', processId, 'transitions'], {
      targetStage: 12,
      expectedVersion: 6,
      situation: 'IN_PROGRESS',
      reason: 'Nova tentativa após exigência',
      checked: true,
    }),
  ).rejects.toMatchObject({ code: 'BLOCKED' });
});

it('encaminha pagamento sem responsável, preserva etapa em retries e pesquisa antes de paginar', async () => {
  const result = await db.query<{ id: string }>(
    'select concloud.save_opening_lead_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as id',
    [
      'c'.repeat(64),
      'Cliente busca automática',
      '00000000001',
      'search@example.invalid',
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
  );
  const id = result.rows[0].id;
  await db.query("update concloud.\"OpeningLead\" set plan='essencial',state='SP' where id=$1", [
    id,
  ]);
  expect(
    (await db.query('select id from concloud."OpeningProcess" where "leadId"=$1', [id])).rows,
  ).toHaveLength(0);
  // Exercise the exact restricted-runtime function used by the authenticated payment webhook.
  await asActor(() =>
    db.query(
      "select concloud.update_opening_lead_payment($1,null,'PAID','TEST_BYPASS',null,null)",
      [id],
    ),
  );
  const p = (
    await db.query<{ id: string; stage: number; workflow: string }>(
      'select * from concloud."OpeningProcess" where "leadId"=$1',
      [id],
    )
  ).rows[0];
  expect(p).toMatchObject({ stage: 1, workflow: 'JUCESP' });
  const event = (
    await db.query<{ actorId: string | null; evidence: { testPayment: boolean } }>(
      'select * from concloud."OpeningProcessEvent" where "processId"=$1',
      [p.id],
    )
  ).rows[0];
  expect(event.actorId).toBeNull();
  expect(event.evidence.testPayment).toBe(true);
  await db.query('update concloud."OpeningProcess" set stage=2,version=2 where id=$1', [p.id]);
  await asActor(() =>
    db.query(
      "select concloud.update_opening_lead_payment($1,null,'PAID','TEST_BYPASS',null,null)",
      [id],
    ),
  );
  expect(
    (await db.query('select stage,version from concloud."OpeningProcess" where id=$1', [p.id]))
      .rows[0],
  ).toEqual({ stage: 2, version: 2 });
  expect(
    (await db.query('select id from concloud."OpeningProcessEvent" where "processId"=$1', [p.id]))
      .rows,
  ).toHaveLength(1);
  const found = (await asActor(() =>
    operations(
      tx,
      actor,
      staff,
      new Request('https://example.invalid?search=search%40example.invalid'),
      ['processes'],
    ),
  )) as { items: { id: string; testPayment: boolean }[] };
  expect(found.items).toHaveLength(1);
  expect(found.items[0]).toMatchObject({ id: p.id, testPayment: true });
  const absent = (await asActor(() =>
    operations(tx, actor, staff, new Request('https://example.invalid?search=%25'), ['processes']),
  )) as { items: unknown[] };
  expect(absent.items).toHaveLength(0); // '%' is literal, not an unrestricted LIKE wildcard.
  expect(
    (
      await asActor(
        () => db.query('select id from concloud."OpeningProcess" where id=$1', [p.id]),
        client,
      )
    ).rows,
  ).toHaveLength(0);
});

it('backfill recebe pagamentos antigos e deixa UF indefinida somente na triagem', async () => {
  const id = (
    await db.query<{ id: string }>(
      'select concloud.save_opening_lead_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as id',
      [
        'd'.repeat(64),
        'Cadastro antigo',
        '00000000002',
        'old@example.invalid',
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
  await db.exec('alter table concloud."OpeningLead" disable trigger opening_dispatch_paid');
  await db.query('update concloud."OpeningLead" set "paymentStatus"=\'PAID\' where id=$1', [id]);
  await db.exec('alter table concloud."OpeningLead" enable trigger opening_dispatch_paid');
  const migration = await readFile(
    'packages/database/migrations/20261026212320_opening_automatic_dispatch/migration.sql',
    'utf8',
  );
  const backfill = migration.slice(migration.indexOf('with created as'));
  await db.exec(backfill);
  await db.exec(backfill);
  const p = (
    await db.query<{ id: string }>('select * from concloud."OpeningProcess" where "leadId"=$1', [
      id,
    ])
  ).rows[0];
  expect(p).toMatchObject({ workflow: 'TRIAGE', stage: 1 });
  expect(
    (await db.query('select id from concloud."OpeningProcessEvent" where "processId"=$1', [p.id]))
      .rows,
  ).toHaveLength(1);
  await expect(
    call(['processes', p.id, 'transitions'], {
      targetStage: 1,
      expectedVersion: 1,
      situation: 'DONE',
      checked: true,
      reason: 'Tentativa sintética',
    }),
  ).rejects.toMatchObject({ code: 'BLOCKED' });
});

it('arrastar reutiliza apenas checklist explicitamente salvo na versão atual', async () => {
  const id = (
    await db.query<{ id: string }>(
      'select concloud.save_opening_lead_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as id',
      [
        'e'.repeat(64),
        'Drag sintético',
        '00000000003',
        'drag@example.invalid',
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
  await db.query(
    'update concloud."OpeningLead" set plan=\'mei\',"paymentStatus"=\'PAID\' where id=$1',
    [id],
  );
  const p = (
    await db.query<{ id: string }>('select id from concloud."OpeningProcess" where "leadId"=$1', [
      id,
    ])
  ).rows[0];
  const move = (targetStage: number, expectedVersion: number, mode: string, checked = false) =>
    call(['processes', p.id, 'transitions'], {
      targetStage,
      expectedVersion,
      mode,
      checked,
      situation: 'IN_PROGRESS',
      reason: 'Movimentação sintética',
    });
  await expect(move(2, 1, 'drag', true)).rejects.toMatchObject({ code: 'BLOCKED' });
  await move(1, 1, 'manual', true);
  await move(2, 2, 'drag');
  await move(1, 3, 'manual');
  await expect(move(2, 4, 'drag')).rejects.toMatchObject({ code: 'BLOCKED' });
  expect(
    (await db.query('select stage,version from concloud."OpeningProcess" where id=$1', [p.id]))
      .rows[0],
  ).toEqual({ stage: 1, version: 4 });
});

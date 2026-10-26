import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { pagBankPlans } from '../apps/web/src/lib/pagbank';

it('cobra R$ 39,90 no plano MEI', () => {
  expect(pagBankPlans.mei.amount).toBe(3990);
});

it('exige cinco documentos para MEI e preserva IPTU nos demais planos', async () => {
  const db = new PGlite();
  const id = '00000000-0000-4000-8000-000000000001';
  const actor = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      create schema concloud;
      create role concloud_runtime;
      create table concloud."OpeningLead" (
        id uuid primary key, "authUserId" uuid, "paymentStatus" text,
        "documentsSubmittedAt" timestamptz, partners jsonb,
        plan text constraint "OpeningLead_plan_check" check (plan in ('essencial','gestao','proximo'))
      );
      create table concloud."OpeningLeadDocument" ("openingLeadId" uuid, kind text);
    `);
    await db.exec(
      await readFile(
        'packages/database/migrations/20261026120000_opening_mei/migration.sql',
        'utf8',
      ),
    );
    await db.query(
      `insert into concloud."OpeningLead" (id,"authUserId","paymentStatus",partners,plan)
      values ($1,$2,'PAID','[{"name":"Titular"}]','mei')`,
      [id, actor],
    );
    const finalize = () =>
      db.query('select concloud.complete_opening_lead_documents($1,$2)', [id, actor]);
    await expect(finalize()).rejects.toThrow('opening documents incomplete');
    for (const kind of [
      'socio-1-identidade',
      'socio-1-titulo',
      'socio-1-estado-civil',
      'socio-1-endereco-socio',
      'endereco-empresa',
    ]) {
      await db.query('insert into concloud."OpeningLeadDocument" values ($1,$2)', [id, kind]);
    }
    await expect(finalize()).resolves.toBeDefined();
    const context = await db.query<{ plan: string }>(
      'select * from concloud.get_opening_lead_document_context_v2($1,$2)',
      [id, actor],
    );
    expect(context.rows).toHaveLength(5);
    expect(context.rows[0].plan).toBe('mei');
    expect(
      (
        await db.query('select * from concloud.get_opening_lead_document_context_v2($1,$2)', [
          id,
          id,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query('select concloud.complete_opening_lead_documents($1,$2)', [id, id]),
    ).rejects.toThrow('opening lead not authorized');
    await db.exec(`update concloud."OpeningLead" set plan='essencial'`);
    await expect(finalize()).rejects.toThrow('opening documents incomplete');
    await db.query('insert into concloud."OpeningLeadDocument" values ($1,\'iptu\')', [id]);
    await expect(finalize()).resolves.toBeDefined();
  } finally {
    await db.close();
  }
});

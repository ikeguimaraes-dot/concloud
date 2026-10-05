import 'dotenv/config';
import { Pool } from 'pg';
import { beforeAll, afterAll, it, expect, describe } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  command,
  createCompany,
  acceptInvitation,
  uploadDocument,
  readCompany,
  downloadDocument,
} from '../apps/web/src/lib/service';
import { database, transaction } from '../packages/database/client';
const local = /^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(
  process.env.MIGRATION_DATABASE_URL ?? '',
);
const run = local ? describe : describe.skip;
run('serviços com PostgreSQL nativo e runtime NOBYPASSRLS', () => {
  const dbname = `concloud_test_${Date.now()}`;
  let adminDb: Pool;
  let testDb: Pool;
  const a = {
      id: '10000000-0000-4000-8000-000000000001',
      email: 'admin@example.invalid',
      aal: 'aal2',
    },
    client = {
      id: '10000000-0000-4000-8000-000000000003',
      email: 'client@example.invalid',
      aal: 'aal2',
    },
    reviewer = {
      id: '10000000-0000-4000-8000-000000000002',
      email: 'reviewer@example.invalid',
      aal: 'aal2',
    };
  const co = '30000000-0000-4000-8000-000000000001',
    org = '20000000-0000-4000-8000-000000000001',
    account = '40000000-0000-4000-8000-000000000001';
  beforeAll(async () => {
    adminDb = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
    await adminDb.query(`CREATE DATABASE ${dbname}`);
    const adminUrl = new URL(process.env.MIGRATION_DATABASE_URL!);
    adminUrl.pathname = '/' + dbname;
    testDb = new Pool({ connectionString: adminUrl.toString() });
    for (const name of [
      '20261005120000_initial',
      '20261005120100_dispatcher',
      '20261005120200_integrity',
      '20261005120300_client_revision',
      '20261005120400_team_labels',
    ])
      await testDb.query(
        await readFile(`packages/database/migrations/${name}/migration.sql`, 'utf8'),
      );
    await testDb.query(await readFile('packages/database/seed.sql', 'utf8'));
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = '/' + dbname;
    process.env.DATABASE_URL = url.toString();
    process.env.DEMO_MODE = 'true';
  });
  afterAll(async () => {
    await database().$disconnect();
    await testDb?.end();
    await adminDb?.query(`DROP DATABASE ${dbname} WITH (FORCE)`);
    await adminDb?.end();
  });
  it('nega empresa não atribuída e falta de MFA de interno', async () => {
    await expect(readCompany(client, '30000000-0000-4000-8000-000000000002')).rejects.toThrow();
    await expect(readCompany({ ...a, aal: 'aal1' }, co)).rejects.toThrow('duas etapas');
  });
  it('cria empresa e aceita convite uma vez com e-mail correspondente', async () => {
    const newId = await createCompany(a, {
      organizationId: org,
      name: 'Empresa de integração sintética',
      cnpj: '04252011000110',
      regime: 'SIMPLES_NACIONAL',
    });
    const invite = await command(a, newId, 'invite', {
      email: client.email,
      role: 'CLIENT_MEMBER',
    });
    const token = new URL(invite.link!, 'http://localhost').searchParams.get('token')!;
    await expect(acceptInvitation(reviewer, token)).rejects.toThrow();
    expect(await acceptInvitation(client, token)).toBe(newId);
    await expect(acceptInvitation(client, token)).rejects.toThrow();
    expect((await readCompany(client, newId)).company.id).toBe(newId);
  });
  it('liquidação parcial, reexecução idempotente, estorno e transferência', async () => {
    await command(client, co, 'title', {
      description: 'Título sintético',
      kind: 'RECEIVABLE',
      amount: '100.00',
      issueDate: '2026-10-01',
      competence: '2026-10',
      dueDate: '2026-10-10',
      count: '1',
    });
    let d = await readCompany(client, co);
    const installment = d.installments[0];
    const data = {
      installmentId: installment.id,
      bankAccountId: account,
      principal: '30',
      interest: '2',
      fine: '1',
      discount: '1',
      paidAt: '2026-10-05',
      idempotencyKey: crypto.randomUUID(),
    };
    await command(client, co, 'settle', data);
    await command(client, co, 'settle', data);
    d = await readCompany(client, co);
    expect(d.settlements).toHaveLength(1);
    await expect(
      command(client, co, 'settle', {
        ...data,
        principal: '80',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow('saldo');
    await command(client, co, 'reverseSettlement', {
      id: d.settlements[0].id,
      reason: 'Correção de teste rastreável',
    });
    await command(client, co, 'transfer', {
      sourceId: account,
      targetId: '40000000-0000-4000-8000-000000000002',
      amount: '20',
      date: '2026-10-05',
      idempotencyKey: crypto.randomUUID(),
    });
    d = await readCompany(client, co);
    expect(d.titles).toHaveLength(1);
    expect(d.transfers).toHaveLength(1);
  });
  it('importação deduplica arquivo e transação sem criar título', async () => {
    const p = {
      bankAccountId: account,
      filename: 'fixture.csv',
      source: 'data;descricao;valor;id\n2026-10-05;Serviço;20;fit1',
      format: 'CSV',
      idColumn: 'id',
      confirm: 'yes',
    };
    const preview = await command(client, co, 'previewImport', p);
    await command(client, co, 'import', { ...p, previewHash: preview.previewHash });
    await command(client, co, 'import', { ...p, previewHash: preview.previewHash });
    const changed = { ...p, source: p.source + '\n' };
    await command(client, co, 'import', {
      ...changed,
      previewHash: (await command(client, co, 'previewImport', changed)).previewHash,
    });
    const d = await readCompany(client, co);
    expect(d.transactions).toHaveLength(1);
    expect(d.titles).toHaveLength(1);
  });
  it('concorrência em recorrências não duplica efeitos; reexecução converge', async () => {
    await command(client, co, 'recurrence', {
      description: 'Recorrência sintética',
      kind: 'PAYABLE',
      amount: '70',
      startMonth: '2026-10',
      day: '10',
    });
    await Promise.allSettled([
      command(client, co, 'generateRecurrence', { month: '2026-10' }),
      command(client, co, 'generateRecurrence', { month: '2026-10' }),
    ]);
    await command(client, co, 'generateRecurrence', { month: '2026-10' });
    expect((await readCompany(client, co)).titles.filter((t) => t.recurrenceKey)).toHaveLength(1);
  });
  it('conciliação parcial evita sobrealocação e impede estorno antes do desfazimento', async () => {
    let d = await readCompany(client, co);
    const installment = d.installments.find(
      (i) => d.titles.find((t) => t.id === i.titleId)?.kind === 'RECEIVABLE',
    )!;
    await command(client, co, 'settle', {
      installmentId: installment.id,
      bankAccountId: account,
      principal: '20',
      paidAt: '2026-10-05',
      idempotencyKey: crypto.randomUUID(),
    });
    d = await readCompany(client, co);
    const settlement = d.settlements.find((s) => !s.reversedAt)!;
    const movement = d.transactions[0];
    await command(client, co, 'reconcile', {
      transactionId: movement.id,
      settlementId: settlement.id,
      amount: '10',
    });
    await expect(
      command(client, co, 'reconcile', {
        transactionId: movement.id,
        settlementId: settlement.id,
        amount: '11',
      }),
    ).rejects.toThrow('saldo');
    await command(client, co, 'reconcile', {
      transactionId: movement.id,
      settlementId: settlement.id,
      amount: '10',
    });
    await expect(
      command(client, co, 'reverseSettlement', {
        id: settlement.id,
        reason: 'Correção rastreável de teste',
      }),
    ).rejects.toThrow('conciliações');
    for (const row of (await readCompany(client, co)).reconciliations)
      await command(client, co, 'undoReconciliation', {
        id: row.id,
        reason: 'Desfazimento sintético de teste',
      });
    await command(client, co, 'reverseSettlement', {
      id: settlement.id,
      reason: 'Correção rastreável de teste',
    });
  });
  it('liquidações concorrentes não ultrapassam o principal', async () => {
    await command(client, co, 'title', {
      description: 'Concorrência',
      kind: 'RECEIVABLE',
      amount: '100',
      issueDate: '2026-10-01',
      competence: '2026-10',
      dueDate: '2026-10-15',
      count: 1,
    });
    let d = await readCompany(client, co);
    const title = d.titles.find((t) => t.description === 'Concorrência')!;
    const installment = d.installments.find((i) => i.titleId === title.id)!;
    const pay = () =>
      command(client, co, 'settle', {
        installmentId: installment.id,
        bankAccountId: account,
        principal: '80',
        paidAt: '2026-10-05',
        idempotencyKey: crypto.randomUUID(),
      });
    const results = await Promise.allSettled([pay(), pay()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    d = await readCompany(client, co);
    expect(d.settlements.filter((s) => s.installmentId === installment.id)).toHaveLength(1);
  });
  it('exportação preserva snapshot e detecta alterações posteriores', async () => {
    await command(a, co, 'period', {
      competence: '2026-10',
      responsibleId: a.id,
      reviewerId: reviewer.id,
      dueDate: '2026-10-20',
    });
    let d = await readCompany(a, co);
    const period = d.periods[0];
    for (const to of ['UNDER_REVIEW', 'READY_FOR_PROCESSING'])
      await command(a, co, 'transition', {
        periodId: period.id,
        to,
        reason: 'Conferência sintética registrada',
      });
    await Promise.allSettled([
      command(a, co, 'export', { periodId: period.id }),
      command(a, co, 'export', { periodId: period.id }),
    ]);
    await command(a, co, 'export', { periodId: period.id });
    d = await readCompany(a, co);
    expect(d.batches).toHaveLength(1);
    await expect(
      testDb.query('UPDATE concloud."ExportBatch" SET snapshot=\'{}\' WHERE id=$1', [
        d.batches[0].id,
      ]),
    ).rejects.toThrow('immutable');
    await command(client, co, 'title', {
      description: 'Entrada após exportação',
      kind: 'PAYABLE',
      amount: '10',
      issueDate: '2026-10-01',
      competence: '2026-10',
      dueDate: '2026-10-15',
      count: 1,
    });
    d = await readCompany(a, co);
    expect(d.periods[0].revision).not.toBe(d.periods[0].exportedRevision);
    await expect(
      command(a, co, 'transition', {
        periodId: period.id,
        to: 'PROCESSING_EXTERNALLY',
        reason: 'Tentativa com entrada alterada',
      }),
    ).rejects.toThrow();
    await command(reviewer, co, 'transition', {
      periodId: period.id,
      to: 'UNDER_REVIEW',
      reason: 'Reabertura justificada e rastreável',
    });
  });
  it('documentos privados e revisão restrita à equipe', async () => {
    const doc = await uploadDocument(
      a,
      co,
      { title: 'Resultado sintético', competence: '2026-10', classification: 'RESULT' },
      new File(['%PDF-1.7\nfixture'], 'f.pdf', { type: 'application/pdf' }),
    );
    expect((await readCompany(client, co)).documents.some((d) => d.id === doc)).toBe(false);
    await expect(downloadDocument(client, co, doc)).rejects.toThrow();
    await expect(command(client, co, 'publish', { id: doc })).rejects.toThrow();
    await command(reviewer, co, 'publish', { id: doc });
    expect((await readCompany(client, co)).documents.some((d) => d.id === doc)).toBe(true);
  });
  it('guia mantém pagamento informado, comprovante e conferência separados', async () => {
    const guideDoc = await uploadDocument(
      a,
      co,
      { title: 'Guia sintética de teste', competence: '2026-10', classification: 'GUIDE' },
      new File(['%PDF-1.7\nGuia sintética sem validade fiscal'], 'g.pdf', {
        type: 'application/pdf',
      }),
    );
    await command(reviewer, co, 'publish', { id: guideDoc });
    await command(a, co, 'guide', {
      name: 'Obrigação sintética',
      competence: '2026-10',
      documentId: guideDoc,
      amount: '50',
      dueDate: '2026-10-20',
    });
    let d = await readCompany(client, co);
    await command(client, co, 'reportPayment', {
      guideId: d.guides[0].id,
      amount: '50',
      paidAt: '2026-10-10',
    });
    d = await readCompany(client, co);
    expect(d.payments[0].status).toBe('REPORTED');
    await expect(command(client, co, 'verifyPayment', { id: d.payments[0].id })).rejects.toThrow();
    await expect(command(reviewer, co, 'verifyPayment', { id: d.payments[0].id })).rejects.toThrow(
      'comprovante',
    );
    const proof = await uploadDocument(
      client,
      co,
      { title: 'Comprovante sintético', competence: '2026-10', classification: 'PROOF' },
      new File(['%PDF-1.7\nComprovante sintético'], 'p.pdf', { type: 'application/pdf' }),
    );
    await command(client, co, 'attachProof', { id: d.payments[0].id, documentId: proof });
    expect((await readCompany(client, co)).payments[0].status).toBe('PROOF_ATTACHED');
    await command(reviewer, co, 'verifyPayment', { id: d.payments[0].id });
    expect((await readCompany(client, co)).payments[0].status).toBe('VERIFIED');
  });
  it('cliente não pode mudar etapa no banco enquanto marca revisões de entrada', async () => {
    await expect(
      transaction(
        client,
        (tx) =>
          tx.$executeRaw`UPDATE concloud."AccountingPeriod" SET state='CLOSED' WHERE "companyId"=${co}::uuid`,
      ),
    ).rejects.toThrow();
  });
  it('contexto transacional não vaza no pool real', async () => {
    await transaction(client, (tx) => tx.company.findMany());
    const rows = await database().$queryRaw<
      { actor: string | null }[]
    >`SELECT nullif(current_setting('app.user_id',true),'') AS actor`;
    expect(rows[0].actor).toBeNull();
    expect(await database().company.count()).toBe(0);
  });
});

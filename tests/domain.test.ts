import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  money,
  outstanding,
  splitInstallments,
  settlementCash,
} from '../packages/domain/src/money';
import { validCnpj } from '../packages/domain/src/cnpj';
import { authorize, assertScope } from '../packages/domain/src/permissions';
import { transition, type Evidence } from '../packages/domain/src/closing';
import { parseCsv, csvCell } from '../packages/domain/src/imports';
import { readOfx } from '../packages/integrations/src/ofx';
import { ManualAccountingAdapter, type Snapshot } from '../packages/integrations/src/accounting';
import { validateUpload } from '../packages/integrations/src/storage';
const e: Evidence = {
  pending: 0,
  tasksPending: 0,
  exportReady: true,
  processed: true,
  approved: true,
  published: true,
  dirty: false,
  reviewer: true,
};
describe('dinheiro e financeiro', () => {
  it('preserva centavos e arredondamento explícito', () => {
    expect(money('0.1').plus('0.2').toFixed(2)).toBe('0.30');
    expect(money('1.005').toFixed(2)).toBe('1.01');
    expect(splitInstallments('100', 3)).toEqual(['33.34', '33.33', '33.33']);
  });
  it('preserva saldo parcial e ignora estorno', () => {
    expect(
      outstanding('100', [
        { principal: '30', reversedAt: null },
        { principal: '20', reversedAt: new Date() },
      ]).toFixed(2),
    ).toBe('70.00');
  });
  it('separa encargos de principal', () => {
    expect(settlementCash('100', '5', '2', '3')).toBe('104.00');
    expect(() => settlementCash('100', '0', '0', '101')).toThrow();
  });
});
describe('CNPJ oficial e acesso', () => {
  it('aceita numérico e exemplo oficial alfanumérico', () => {
    expect(validCnpj('11.222.333/0001-81')).toBe(true);
    expect(validCnpj('12.ABC.345/01DE-35')).toBe(true);
    expect(validCnpj('12ABC34501DE36')).toBe(false);
    expect(validCnpj('00000000000000')).toBe(false);
  });
  it('nega privilégios e escopos diferentes', () => {
    expect(() => authorize('CLIENT_OWNER', 'review')).toThrow();
    expect(() => authorize('ASSISTANT', 'admin')).toThrow();
    expect(() =>
      assertScope({ organizationId: 'a', companyId: 'c' }, { organizationId: 'a', companyId: 'd' }),
    ).toThrow();
  });
});
describe('fechamento', () => {
  it('exige evidências para cada etapa', () => {
    expect(() =>
      transition(
        'UNDER_REVIEW',
        'READY_FOR_PROCESSING',
        { ...e, pending: 1 },
        'Conferência concluída',
      ),
    ).toThrow();
    expect(() =>
      transition(
        'READY_FOR_PROCESSING',
        'PROCESSING_EXTERNALLY',
        { ...e, dirty: true },
        'Iniciando processamento',
      ),
    ).toThrow();
    expect(() =>
      transition('QUALITY_REVIEW', 'DELIVERED', { ...e, approved: false }, 'Entrega revisada'),
    ).toThrow();
  });
  it('exige revisor e justificativa para reabrir', () => {
    expect(() => transition('CLOSED', 'UNDER_REVIEW', e, 'Correção solicitada')).not.toThrow();
    expect(() =>
      transition('CLOSED', 'UNDER_REVIEW', { ...e, reviewer: false }, 'Correção solicitada'),
    ).toThrow();
    expect(() => transition('CLOSED', 'UNDER_REVIEW', e, '')).toThrow();
  });
});
describe('arquivos não confiáveis', () => {
  it('valida datas, duplicidades e linhas rejeitadas', () => {
    const p = parseCsv(
      'data;descricao;valor;id\n05/10/2026;Serviço;1.000,50;a\n05/10/2026;Serviço;1.000,50;a\n31/02/2026;Inválida;10;b',
      { date: 'data', description: 'descricao', amount: 'valor', id: 'id' },
    );
    expect(p.accepted).toHaveLength(1);
    expect(p.accepted[0].amount).toBe('1000.50');
    expect(p.rejected).toHaveLength(2);
  });
  it('protege CSV contra fórmulas', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(csvCell('  @evil')).toBe('"\'  @evil"');
  });
  it('parseia OFX com FITID', async () => {
    const rows = await readOfx(await readFile('tests/fixtures/bank.ofx', 'utf8'));
    expect(rows).toHaveLength(2);
    expect(rows[1].amount).toBe('-20.00');
    expect(rows[0].externalId).toBe('synthetic-001');
  });
  it('nega extensão e conteúdo incompatível', () => {
    expect(() => validateUpload(Buffer.from('<script>evil</script>'), 'application/pdf')).toThrow();
    expect(() => validateUpload(Buffer.from('%PDF-1.7\nfixture'), 'application/pdf')).not.toThrow();
  });
});
it('pacotes reexecutados são determinísticos e têm manifesto genérico', async () => {
  const s: Snapshot = {
    company: { name: 'Sintética', cnpj: '12ABC34501DE35', accountingSystemId: null },
    competence: '2026-10',
    revision: 1,
    titles: [],
    documents: [],
  };
  const adapter = new ManualAccountingAdapter();
  const a = await adapter.buildPackage(s, 1, async () => new Uint8Array());
  const b = await adapter.buildPackage(s, 1, async () => new Uint8Array());
  expect(a.bytes).toEqual(b.bytes);
  expect(a.manifest.format).toBe('ConCloud generic export');
  expect(a.manifest.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
});

import { brl, fmtDate } from '../apps/web/src/lib/reports';
it('formata centavos grandes sem float e conserva data de negócio', () => {
  expect(brl('9007199254740991.99')).toContain('9.007.199.254.740.991,99');
  expect(fmtDate(new Date('2026-10-10T00:00:00Z'))).toBe('10/10/2026');
});

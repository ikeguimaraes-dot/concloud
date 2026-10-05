import { parse as parseOfx } from 'ofx-js';
import { assert } from '../../domain/src/errors';
import { isoDate, type ImportRow } from '../../domain/src/imports';
import { money } from '../../domain/src/money';
type Node = { [key: string]: unknown };
export async function readOfx(source: string): Promise<ImportRow[]> {
  assert(Buffer.byteLength(source) <= 5_000_000, 'OFX excede 5 MB.');
  assert(!/<!DOCTYPE|<!ENTITY/i.test(source), 'Declarações XML externas não são permitidas.');
  const result: unknown = await parseOfx(source);
  const entries: Node[] = [];
  function walk(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const o = value as Node;
    if ('TRNAMT' in o && 'DTPOSTED' in o) entries.push(o);
    else Object.values(o).forEach(walk);
  }
  walk(result);
  assert(
    entries.length > 0 && entries.length <= 10000,
    'OFX sem transações válidas ou excede o limite.',
  );
  return entries.map((e) => {
    const raw = String(e.DTPOSTED).slice(0, 8);
    const date = isoDate(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`);
    const amount = money(String(e.TRNAMT));
    assert(amount.isFinite() && !amount.isZero(), 'Valor OFX inválido.');
    const externalId = String(e.FITID ?? '');
    assert(externalId.length > 0 && externalId.length <= 200, 'OFX exige FITID.');
    return {
      date,
      amount: amount.toFixed(2),
      externalId,
      description: String(e.MEMO ?? e.NAME ?? 'Movimentação OFX').slice(0, 500),
    };
  });
}

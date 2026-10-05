import { parse } from 'csv-parse/sync';
import { createHash } from 'node:crypto';
import { money } from './money';
import { assert } from './errors';
export type ImportRow = { externalId: string; date: string; description: string; amount: string };
export function isoDate(s: string) {
  const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s.split('/').reverse().join('-') : s;
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
      !isNaN(Date.parse(iso)) &&
      new Date(iso).toISOString().slice(0, 10) === iso,
    'Data inválida.',
  );
  return iso;
}
export function parseCsv(
  text: string,
  map: { date: string; description: string; amount: string; id?: string },
  delimiter = ';',
) {
  assert(Buffer.byteLength(text) <= 5_000_000, 'Arquivo excede 5 MB.');
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    delimiter,
    relax_column_count: false,
  }) as Record<string, string>[];
  assert(rows.length <= 10000, 'Limite de 10.000 linhas.');
  const accepted: ImportRow[] = [];
  const rejected: { line: number; reason: string }[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    try {
      const date = isoDate(r[map.date]?.trim() ?? '');
      const raw = r[map.amount]?.trim().replace(/R\$\s*/, '') ?? '';
      const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
      assert(/^-?\d+(\.\d{1,2})?$/.test(normalized), 'Valor inválido.');
      const amount = money(normalized).toFixed(2);
      assert(amount !== '0.00', 'Valor não pode ser zero.');
      const description = r[map.description]?.trim();
      assert(
        description && description.length <= 500,
        'Descrição obrigatória, até 500 caracteres.',
      );
      const externalId =
        (map.id ? r[map.id]?.trim() : null) ||
        createHash('sha256').update(`${date}|${description}|${amount}`).digest('hex');
      assert(!seen.has(externalId), 'Identificador duplicado no arquivo.');
      seen.add(externalId);
      accepted.push({ date, description, amount, externalId });
    } catch (e) {
      rejected.push({ line: i + 2, reason: e instanceof Error ? e.message : 'Linha inválida' });
    }
  });
  return { accepted, rejected };
}
export function csvCell(value: string) {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export const csv = (rows: string[][]) =>
  '\ufeff' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
export function suggestMatches(
  transaction: ImportRow,
  candidates: { id: string; amount: string; date: string; description: string }[],
) {
  return candidates
    .map((c) => ({
      id: c.id,
      score:
        (money(c.amount).eq(money(transaction.amount).abs()) ? 60 : 0) +
        (Math.abs(Date.parse(c.date) - Date.parse(transaction.date)) <= 3 * 86400000 ? 25 : 0) +
        (c.description.toLowerCase().includes(transaction.description.toLowerCase()) ? 15 : 0),
    }))
    .filter((c) => c.score >= 60)
    .sort((a, b) => b.score - a.score);
}

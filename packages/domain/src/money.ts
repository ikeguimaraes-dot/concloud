import Decimal from 'decimal.js';
import { assert } from './errors';
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export const money = (value: string | Decimal) =>
  new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export function positive(value: string) {
  const d = money(value);
  assert(d.isFinite() && d.gt(0), 'O valor deve ser positivo.');
  return d;
}
export function outstanding(
  amount: string,
  settlements: { principal: string; reversedAt: unknown }[],
) {
  return settlements
    .filter((s) => !s.reversedAt)
    .reduce((v, s) => v.minus(s.principal), money(amount));
}
export function splitInstallments(amount: string, count: number) {
  assert(Number.isInteger(count) && count > 0 && count <= 120, 'Quantidade de parcelas inválida.');
  const cents = positive(amount).mul(100);
  assert(cents.gte(count), 'Valor insuficiente para as parcelas.');
  const base = cents.div(count).floor();
  return Array.from({ length: count }, (_, i) =>
    base
      .plus(i < cents.mod(count).toNumber() ? 1 : 0)
      .div(100)
      .toFixed(2),
  );
}
export function settlementCash(principal: string, interest = '0', fine = '0', discount = '0') {
  const p = positive(principal);
  for (const n of [interest, fine, discount])
    assert(money(n).gte(0), 'Encargos não podem ser negativos.');
  const cash = p.plus(interest).plus(fine).minus(discount);
  assert(cash.gte(0), 'Desconto maior que a liquidação.');
  return cash.toFixed(2);
}

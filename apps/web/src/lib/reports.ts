import { money, outstanding, settlementCash } from '@domain/money';
import type { CompanyData } from './service';
export const brl = (value: string) => {
  const [integer, fraction] = money(value).toFixed(2).split('.');
  const negative = integer.startsWith('-');
  return `${negative ? '-' : ''}R$\u00a0${BigInt(integer.replace('-', '')).toLocaleString('pt-BR')},${fraction}`;
};
export const fmtDate = (d: Date | string) => {
  const value = new Date(d);
  const dateOnly = value.toISOString().endsWith('T00:00:00.000Z');
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: dateOnly ? 'UTC' : 'America/Sao_Paulo',
  }).format(value);
};
export const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export function balance(d: CompanyData, installmentId: string) {
  const installment = d.installments.find((i) => i.id === installmentId);
  return installment
    ? outstanding(
        installment.amount.toString(),
        d.settlements
          .filter((s) => s.installmentId === installmentId)
          .map((s) => ({ principal: s.principal.toString(), reversedAt: s.reversedAt })),
      )
    : money('0');
}
export function reports(d: CompanyData, month?: string, categoryId?: string) {
  const titles = d.titles.filter(
    (t) =>
      (!month || t.competence.toISOString().startsWith(month)) &&
      (!categoryId || t.categoryId === categoryId),
  );
  const income = titles
    .filter((t) => t.kind === 'RECEIVABLE')
    .reduce((a, t) => a.plus(t.amount.toString()), money('0'));
  const expense = titles
    .filter((t) => t.kind === 'PAYABLE')
    .reduce((a, t) => a.plus(t.amount.toString()), money('0'));
  let receivable = money('0'),
    payable = money('0'),
    received = money('0'),
    paid = money('0');
  for (const i of d.installments) {
    const title = d.titles.find((t) => t.id === i.titleId);
    if (!title || (categoryId && title.categoryId !== categoryId)) continue;
    if (!month || i.dueDate.toISOString().startsWith(month)) {
      if (title.kind === 'RECEIVABLE') receivable = receivable.plus(balance(d, i.id));
      else payable = payable.plus(balance(d, i.id));
    }
    for (const s of d.settlements.filter(
      (s) =>
        s.installmentId === i.id &&
        !s.reversedAt &&
        (!month || s.paidAt.toISOString().startsWith(month)),
    )) {
      const cash = settlementCash(
        s.principal.toString(),
        s.interest.toString(),
        s.fine.toString(),
        s.discount.toString(),
      );
      if (title.kind === 'RECEIVABLE') received = received.plus(cash);
      else paid = paid.plus(cash);
    }
  }
  return { income, expense, receivable, payable, received, paid, result: income.minus(expense) };
}

export function bankBalance(d: CompanyData, accountId: string) {
  let result = money(d.accounts.find((a) => a.id === accountId)?.openingBalance.toString() ?? '0');
  for (const s of d.settlements.filter((s) => s.bankAccountId === accountId && !s.reversedAt)) {
    const installment = d.installments.find((i) => i.id === s.installmentId);
    const title = d.titles.find((t) => t.id === installment?.titleId);
    const cash = money(
      settlementCash(
        s.principal.toString(),
        s.interest.toString(),
        s.fine.toString(),
        s.discount.toString(),
      ),
    );
    result = title?.kind === 'RECEIVABLE' ? result.plus(cash) : result.minus(cash);
  }
  for (const transfer of d.transfers) {
    if (transfer.sourceId === accountId) result = result.minus(transfer.amount.toString());
    if (transfer.targetId === accountId) result = result.plus(transfer.amount.toString());
  }
  return result;
}

import 'server-only';

export type PagBankEnvironment = 'sandbox' | 'production';

export function pagBankEnvironment(): PagBankEnvironment {
  return process.env.PAGBANK_ENV === 'production' ? 'production' : 'sandbox';
}

export function pagBankApiUrl(path: string) {
  const base =
    pagBankEnvironment() === 'production'
      ? 'https://api.pagseguro.com'
      : 'https://sandbox.api.pagseguro.com';
  return `${base}${path}`;
}

export function pagBankToken() {
  const token = process.env.PAGBANK_TOKEN;
  if (!token) throw new Error('PAGBANK_TOKEN_NOT_CONFIGURED');
  return token;
}

export function appUrl() {
  const url = process.env.APP_URL?.replace(/\/$/, '');
  if (!url) throw new Error('APP_URL_NOT_CONFIGURED');
  return url;
}

export const pagBankPlans = {
  mei: { name: 'Abertura de CNPJ - MEI', amount: 3990 },
  essencial: { name: 'ConCloud Essencial', amount: 9900 },
  gestao: { name: 'ConCloud Gestão', amount: 14900 },
  proximo: { name: 'ConCloud Próximo', amount: 19900 },
} as const;

export type PagBankPlanId = keyof typeof pagBankPlans;

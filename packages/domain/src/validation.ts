import { z } from 'zod';
import { validCnpj, normalizeCnpj } from './cnpj';
import { isoDate } from './imports';
export const id = z.string().uuid();
export const text = z.string().trim().min(1).max(500);
export const date = z
  .string()
  .refine((s) => {
    try {
      isoDate(s);
      return true;
    } catch {
      return false;
    }
  }, 'Data inválida')
  .transform((s) => new Date(isoDate(s) + 'T12:00:00Z'));
export const amount = z.string().regex(/^\d{1,14}(\.\d{1,2})?$/, 'Use um valor como 1250.50');
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const cnpj = z.string().transform(normalizeCnpj).refine(validCnpj, 'CNPJ inválido');
export const kind = z.enum(['PAYABLE', 'RECEIVABLE']);

import { createHash } from 'node:crypto';

export function openingDraftHash(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Error('INVALID_DRAFT_TOKEN');
  return createHash('sha256').update(token).digest('hex');
}

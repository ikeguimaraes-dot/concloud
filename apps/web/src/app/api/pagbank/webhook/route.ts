import { createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { database } from '@database/client';
import { pagBankApiUrl, pagBankToken } from '@/lib/pagbank';
import { notifyOpeningPaymentConfirmed } from '@/lib/opening-notification';

export const runtime = 'nodejs';

let cachedPublicKey: { value: string; expiresAt: number } | null = null;

async function webhookPublicKey() {
  if (cachedPublicKey && cachedPublicKey.expiresAt > Date.now()) return cachedPublicKey.value;
  const response = await fetch(pagBankApiUrl('/public-keys?type=webhook'), {
    headers: { accept: 'application/json', authorization: `Bearer ${pagBankToken()}` },
    cache: 'no-store',
  });
  const result = (await response.json()) as { public_key?: string };
  if (!response.ok || !result.public_key) throw new Error('PAGBANK_PUBLIC_KEY_UNAVAILABLE');
  cachedPublicKey = { value: result.public_key, expiresAt: Date.now() + 60 * 60 * 1000 };
  return result.public_key;
}

async function validSignature(rawBody: Buffer, signatureHeader: string | null) {
  if (!signatureHeader) return false;
  const publicKey = createPublicKey({
    key: Buffer.from(await webhookPublicKey(), 'base64'),
    format: 'der',
    type: 'spki',
  });
  return signatureHeader
    .split(',')
    .map((signature) => signature.trim())
    .filter(Boolean)
    .some((signature) => {
      try {
        return verify('sha256', rawBody, publicKey, Buffer.from(signature, 'base64'));
      } catch {
        return false;
      }
    });
}

type PagBankEvent = {
  id?: string;
  reference_id?: string;
  status?: string;
  checkout?: { id?: string; reference_id?: string; status?: string };
  charges?: Array<{ id?: string; reference_id?: string; status?: string; paid_at?: string }>;
  subscriptions?: Array<{ id?: string; status?: string }>;
};

const paymentStatuses = new Set([
  'WAITING',
  'IN_ANALYSIS',
  'PAID',
  'DECLINED',
  'CANCELED',
  'EXPIRED',
]);

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  try {
    if (!(await validSignature(rawBody, request.headers.get('x-payload-signature'))))
      return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
    const event = JSON.parse(rawBody.toString('utf8')) as PagBankEvent;
    const charge = event.charges?.[0];
    const status = charge?.status ?? event.status ?? event.checkout?.status;
    const referenceId = charge?.reference_id ?? event.reference_id ?? event.checkout?.reference_id;
    const parsedReference = z.string().uuid().safeParse(referenceId);
    const leadId = parsedReference.success ? parsedReference.data : null;
    const checkoutId = event.checkout?.id ?? (event.id?.startsWith('CHEC_') ? event.id : undefined);
    if (!status || !paymentStatuses.has(status) || (!leadId && !checkoutId))
      return new Response(null, { status: 204 });

    await database().$executeRaw`
      select concloud.update_opening_lead_payment(
        ${leadId}::uuid, ${checkoutId ?? null}, ${status}, ${charge?.id ?? null},
        ${event.subscriptions?.[0]?.id ?? null},
        ${charge?.paid_at ? new Date(charge.paid_at) : null}
      )`;
    if (status === 'PAID' && leadId) {
      try {
        await notifyOpeningPaymentConfirmed(leadId);
      } catch {
        console.error(JSON.stringify({ event: 'pagbank.notification.failed' }));
      }
    }
    return new Response(null, { status: 204 });
  } catch {
    console.error(JSON.stringify({ event: 'pagbank.webhook.failed', code: 'PROCESSING_ERROR' }));
    return Response.json({ error: 'PROCESSING_ERROR' }, { status: 400 });
  }
}

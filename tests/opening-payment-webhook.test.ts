import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ persist: vi.fn(), notify: vi.fn() }));
vi.mock('@database/client', () => ({ database: () => ({ $executeRaw: mocks.persist }) }));
vi.mock('@/lib/pagbank', () => ({
  pagBankApiUrl: () => 'https://payments.example.invalid/key',
  pagBankToken: () => 'synthetic',
}));
vi.mock('@/lib/opening-notification', () => ({ notifyOpeningPaymentConfirmed: mocks.notify }));
import { POST } from '../apps/web/src/app/api/pagbank/webhook/route';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const body = JSON.stringify({
  reference_id: '20000000-0000-4000-8000-000000000001',
  charges: [{ id: 'synthetic', status: 'PAID' }],
});
function request(
  signature = sign('sha256', Buffer.from(body), keys.privateKey).toString('base64'),
) {
  return new Request('https://example.invalid/webhook', {
    method: 'POST',
    body,
    headers: { 'x-payload-signature': signature },
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it('persiste pagamento antes da notificação; falha de e-mail não bloqueia encaminhamento', async () => {
  const sequence: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          public_key: keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
        }),
      ),
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.persist.mockImplementation(async () => {
    sequence.push('persist');
  });
  mocks.notify.mockImplementation(async () => {
    sequence.push('notify');
    throw Error('synthetic email failure');
  });
  expect((await POST(request())).status).toBe(204);
  expect(sequence).toEqual(['persist', 'notify']);
});
it('assinatura inválida não altera pagamento nem notifica', async () => {
  expect((await POST(request('invalid'))).status).toBe(401);
  expect(mocks.persist).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});
it('falha de persistência permite retry e não envia notificação', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.persist.mockRejectedValueOnce(Error('synthetic database failure'));
  expect((await POST(request())).status).toBe(400);
  expect(mocks.notify).not.toHaveBeenCalled();
});

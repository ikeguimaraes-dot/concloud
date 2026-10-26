import { beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));
import { internalActor } from '../apps/web/src/lib/internal-opening';
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic');
  auth.getUser.mockReset();
  auth.getClaims.mockReset();
});
const request = () =>
  new Request('https://example.invalid/api/internal/v1/me', {
    headers: { authorization: 'Bearer synthetic-token' },
  });
it('recusa falta de token sem consultar Auth', async () => {
  await expect(internalActor(new Request('https://example.invalid'))).rejects.toMatchObject({
    status: 401,
  });
  expect(auth.getUser).not.toHaveBeenCalled();
});
it('recusa token expirado ou inválido', async () => {
  auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
  await expect(internalActor(request())).rejects.toMatchObject({ status: 401 });
});
it('exige MFA mesmo se user_metadata afirma privilégios', async () => {
  auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: 'operator',
        email: 'test@example.invalid',
        user_metadata: { role: 'ORG_ADMIN', aal: 'aal2' },
      },
    },
  });
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'operator', aal: 'aal1' } } });
  await expect(internalActor(request())).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
});
it('deriva ator de identidade validada e claims correspondentes', async () => {
  auth.getUser.mockResolvedValue({
    data: { user: { id: 'operator', email: 'test@example.invalid' } },
  });
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'operator', aal: 'aal2' } } });
  expect(await internalActor(request())).toEqual({
    id: 'operator',
    email: 'test@example.invalid',
    aal: 'aal2',
  });
});
it('nega claims de outra identidade', async () => {
  auth.getUser.mockResolvedValue({
    data: { user: { id: 'operator', email: 'test@example.invalid' } },
  });
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'other', aal: 'aal2' } } });
  await expect(internalActor(request())).rejects.toMatchObject({ status: 401 });
});

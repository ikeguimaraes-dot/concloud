import { z } from 'zod';
import { database } from '@database/client';
import { rateLimit } from '@/lib/limits';
import { createClient } from '@supabase/supabase-js';

const schema = z
  .object({
    name: z.string().trim().min(3).max(120),
    cpf: z
      .string()
      .transform((value) => value.replace(/\D/g, ''))
      .pipe(z.string().length(11)),
    email: z.string().trim().email().max(180),
    phone: z.string().trim().min(8).max(30),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[^\p{L}\p{N}]/u),
    passwordConfirmation: z.string().min(8).max(128),
    activity: z.string().trim().min(2).max(180),
    zipCode: z.string().trim().min(5).max(12),
    addressType: z.enum(['residencial', 'orientacao']),
    city: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(20),
    plan: z.enum(['essencial', 'gestao', 'proximo']),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    path: ['passwordConfirmation'],
  });
export async function POST(request: Request) {
  let auth: ReturnType<typeof createClient> | null = null;
  let authUserId: string | null = null;
  try {
    const input = schema.parse(await request.json());
    await rateLimit(`opening:${input.cpf}`, 3);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceRoleKey) {
      auth = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await auth.auth.admin.createUser({
        email: input.email.toLowerCase(),
        password: input.password,
        email_confirm: true,
        user_metadata: { cpf: input.cpf, name: input.name },
      });
      if (error)
        return Response.json(
          { ok: false, error: 'Não foi possível criar o acesso.' },
          { status: 409 },
        );
      authUserId = data.user?.id ?? null;
    }
    const rows = await database().$queryRaw<Array<{ id: string }>>`
      select concloud.submit_opening_lead(
        ${input.name}, ${input.cpf}, ${input.email.toLowerCase()}, ${input.phone},
        ${input.activity}, ${input.zipCode}, ${input.addressType}, ${input.city},
        ${input.state}, ${input.plan}, ${authUserId}::uuid
      ) as id`;
    return Response.json({ ok: true, id: rows[0]?.id }, { status: 201 });
  } catch (error) {
    if (auth && authUserId) await auth.auth.admin.deleteUser(authUserId).catch(() => undefined);
    console.error(
      JSON.stringify({
        event: 'opening.signup.failed',
        code: error instanceof z.ZodError ? 'INVALID_INPUT' : 'UNKNOWN',
      }),
    );
    return Response.json({ ok: false, error: 'Cadastro inválido.' }, { status: 400 });
  }
}

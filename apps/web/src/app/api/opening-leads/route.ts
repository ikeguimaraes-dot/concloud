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
  try {
    const input = schema.parse(await request.json());
    await rateLimit(`opening:${input.cpf}`, 3);
    let authUserId: string | null = null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const auth = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await auth.auth.signUp({
        email: input.email.toLowerCase(),
        password: input.password,
        options: { data: { cpf: input.cpf, name: input.name } },
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
    console.error(
      JSON.stringify({
        event: 'opening.signup.failed',
        code: error instanceof z.ZodError ? 'INVALID_INPUT' : 'UNKNOWN',
      }),
    );
    return Response.json({ ok: false, error: 'Cadastro inválido.' }, { status: 400 });
  }
}

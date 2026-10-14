import { z } from 'zod';
import { database } from '@database/client';
import { rateLimit } from '@/lib/limits';
import { createClient } from '@supabase/supabase-js';
import { openingDraftHash } from '@/lib/opening-draft';

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
    draftToken: z.string().uuid(),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    path: ['passwordConfirmation'],
  });
export async function POST(request: Request) {
  let auth: ReturnType<typeof createClient> | null = null;
  let authUserId: string | null = null;
  let createdAuthUser = false;
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
      if (error) {
        if (error.code === 'email_exists') {
          const { data: existing, error: signInError } = await auth.auth.signInWithPassword({
            email: input.email.toLowerCase(),
            password: input.password,
          });
          if (!signInError && existing.user) {
            authUserId = existing.user.id;
          } else {
            return Response.json(
              {
                ok: false,
                error: 'Este e-mail já possui acesso. Informe a senha cadastrada.',
                reason: 'INVALID_EXISTING_PASSWORD',
              },
              { status: 409 },
            );
          }
        } else {
          console.error(
            JSON.stringify({
              event: 'opening.auth.create.failed',
              code: error.code ?? 'AUTH_CREATE_FAILED',
              status: error.status,
            }),
          );
          return Response.json(
            {
              ok: false,
              error: 'Não foi possível criar o acesso.',
              reason: error.code ?? 'AUTH_CREATE_FAILED',
            },
            { status: 409 },
          );
        }
      } else {
        authUserId = data.user?.id ?? null;
        createdAuthUser = !!authUserId;
      }
    }
    const [capability] = await database().$queryRaw<Array<{ draftAware: boolean }>>`
      select to_regprocedure(
        'concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid,text)'
      ) is not null as "draftAware"`;
    const rows = capability?.draftAware
      ? await database().$queryRaw<Array<{ id: string }>>`
          select concloud.submit_opening_lead(
            ${input.name}, ${input.cpf}, ${input.email.toLowerCase()}, ${input.phone},
            ${input.activity}, ${input.zipCode}, ${input.addressType}, ${input.city},
            ${input.state}, ${input.plan}, ${authUserId}::uuid,
            ${openingDraftHash(input.draftToken)}
          ) as id`
      : await database().$queryRaw<Array<{ id: string }>>`
          select concloud.submit_opening_lead(
            ${input.name}, ${input.cpf}, ${input.email.toLowerCase()}, ${input.phone},
            ${input.activity}, ${input.zipCode}, ${input.addressType}, ${input.city},
            ${input.state}, ${input.plan}, ${authUserId}::uuid
          ) as id`;
    return Response.json({ ok: true, id: rows[0]?.id }, { status: 201 });
  } catch (error) {
    if (auth && authUserId && createdAuthUser)
      await auth.auth.admin.deleteUser(authUserId).catch(() => undefined);
    const databaseCode =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    console.error(
      JSON.stringify({
        event: 'opening.signup.failed',
        code: error instanceof z.ZodError ? 'INVALID_INPUT' : (databaseCode ?? 'UNKNOWN'),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      }),
    );
    return Response.json(
      {
        ok: false,
        error: 'Cadastro inválido.',
        reason: error instanceof z.ZodError ? 'INVALID_INPUT' : (databaseCode ?? 'DATABASE_ERROR'),
      },
      { status: 400 },
    );
  }
}

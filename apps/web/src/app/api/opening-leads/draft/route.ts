import { z } from 'zod';
import { database } from '@database/client';
import { AppError } from '@domain/errors';
import { rateLimit } from '@/lib/limits';
import { openingDraftHash } from '@/lib/opening-draft';

const schema = z.object({
  draftToken: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  cpf: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().length(11)),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(8).max(30),
  step: z.number().int().min(1).max(4),
  activity: z.string().trim().max(180).optional().default(''),
  zipCode: z.string().trim().max(12).optional().default(''),
  addressType: z
    .union([z.literal(''), z.enum(['residencial', 'orientacao'])])
    .optional()
    .default(''),
  city: z.string().trim().max(120).optional().default(''),
  state: z.string().trim().max(20).optional().default(''),
  plan: z
    .union([z.literal(''), z.enum(['mei', 'essencial', 'gestao', 'proximo'])])
    .optional()
    .default(''),
  marketingConsent: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await rateLimit(`opening-draft:${input.cpf}`, 20);

    const [capability] = await database().$queryRaw<Array<{ available: boolean }>>`
      select to_regprocedure(
        'concloud.save_opening_lead_draft(text,text,text,text,text,integer,text,text,text,text,text,text,boolean)'
      ) is not null as available`;

    // Keep the opening flow usable while the additive draft migration is being rolled out.
    // The final submission still persists every field through the legacy function.
    if (!capability?.available)
      return Response.json({ ok: true, persisted: false }, { status: 202 });

    const rows = await database().$queryRaw<Array<{ id: string }>>`
      select concloud.save_opening_lead_draft(
        ${openingDraftHash(input.draftToken)}, ${input.name}, ${input.cpf},
        ${input.email.toLowerCase()}, ${input.phone}, ${input.step}, ${input.activity},
        ${input.zipCode}, ${input.addressType}, ${input.city}, ${input.state}, ${input.plan},
        ${input.marketingConsent}
      ) as id`;
    return Response.json({ ok: true, persisted: true, id: rows[0]?.id });
  } catch (error) {
    const validationError = error instanceof z.ZodError;
    const rateLimitError = error instanceof AppError && error.code === 'RATE_LIMIT';
    const databaseCode =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    console.error(
      JSON.stringify({
        event: 'opening.draft.failed',
        code: validationError
          ? 'INVALID_INPUT'
          : rateLimitError
            ? 'RATE_LIMIT'
            : (databaseCode ?? 'DATABASE_ERROR'),
      }),
    );

    if (!validationError && !rateLimitError)
      return Response.json({ ok: true, persisted: false }, { status: 202 });

    return Response.json(
      {
        ok: false,
        error: rateLimitError ? error.message : 'Revise os dados informados.',
      },
      { status: rateLimitError ? error.status : 400 },
    );
  }
}

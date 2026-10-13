import { z } from 'zod';
import { database } from '@database/client';
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
    .union([z.literal(''), z.enum(['essencial', 'gestao', 'proximo'])])
    .optional()
    .default(''),
  marketingConsent: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await rateLimit(`opening-draft:${input.cpf}`, 20);
    const rows = await database().$queryRaw<Array<{ id: string }>>`
      select concloud.save_opening_lead_draft(
        ${openingDraftHash(input.draftToken)}, ${input.name}, ${input.cpf},
        ${input.email.toLowerCase()}, ${input.phone}, ${input.step}, ${input.activity},
        ${input.zipCode}, ${input.addressType}, ${input.city}, ${input.state}, ${input.plan},
        ${input.marketingConsent}
      ) as id`;
    return Response.json({ ok: true, id: rows[0]?.id });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'opening.draft.failed',
        code: error instanceof z.ZodError ? 'INVALID_INPUT' : 'DATABASE_ERROR',
      }),
    );
    return Response.json(
      { ok: false, error: 'Não foi possível salvar seu progresso.' },
      { status: 400 },
    );
  }
}

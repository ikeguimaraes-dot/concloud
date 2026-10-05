import { z } from 'zod';
import { database } from '@database/client';
import { rateLimit } from '@/lib/limits';

const schema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(8).max(30),
  activity: z.string().trim().min(2).max(180),
  zipCode: z.string().trim().min(5).max(12),
  addressType: z.enum(['residencial', 'orientacao']),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(20),
  plan: z.enum(['essencial', 'gestao', 'proximo']),
});
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await rateLimit(`opening:${input.email.toLowerCase()}`, 3);
    await database()
      .$queryRaw`select concloud.submit_opening_lead(${input.name}, ${input.email.toLowerCase()}, ${input.phone}, ${input.activity}, ${input.zipCode}, ${input.addressType}, ${input.city}, ${input.state}, ${input.plan})`;
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}

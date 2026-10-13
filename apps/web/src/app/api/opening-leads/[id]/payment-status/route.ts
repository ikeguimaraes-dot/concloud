import { z } from 'zod';
import { database } from '@database/client';
import { rateLimit } from '@/lib/limits';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    await rateLimit(`payment-status:${id}`, 30);
    const rows = await database().$queryRaw<Array<{ paymentStatus: string }>>`
      select "paymentStatus" from concloud."OpeningLead" where id=${id}::uuid limit 1`;
    if (!rows[0]) return Response.json({ error: 'Cadastro não encontrado.' }, { status: 404 });
    return Response.json({ status: rows[0].paymentStatus, paid: rows[0].paymentStatus === 'PAID' });
  } catch {
    return Response.json({ error: 'Consulta inválida.' }, { status: 400 });
  }
}

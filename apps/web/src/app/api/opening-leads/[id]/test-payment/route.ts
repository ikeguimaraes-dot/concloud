import { z } from 'zod';
import { database } from '@database/client';
import { rateLimit } from '@/lib/limits';
import { notifyOpeningPaymentConfirmed } from '@/lib/opening-notification';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    const allowedId = process.env.PAYMENT_TEST_LEAD_ID;
    const sandboxEnabled = process.env.PAGBANK_ENV === 'sandbox';
    if (!sandboxEnabled && (!allowedId || id !== allowedId))
      return Response.json({ error: 'Atalho de teste indisponível.' }, { status: 404 });

    const expectedOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : undefined;
    if (!expectedOrigin || request.headers.get('origin') !== expectedOrigin)
      return Response.json({ error: 'Origem não autorizada.' }, { status: 403 });

    await rateLimit(`test-payment:${id}`, 3);
    await notifyOpeningPaymentConfirmed(id);
    await database().$executeRaw`
      select concloud.update_opening_lead_payment(
        ${id}::uuid, ${null}, ${'PAID'}, ${'TEST_BYPASS'}, ${null}, ${new Date()}
      )`;
    return Response.json({
      ok: true,
      redirect: `/documentos-abertura?cadastro=${encodeURIComponent(id)}`,
    });
  } catch {
    return Response.json(
      { error: 'Não foi possível confirmar o pagamento de teste.' },
      { status: 400 },
    );
  }
}

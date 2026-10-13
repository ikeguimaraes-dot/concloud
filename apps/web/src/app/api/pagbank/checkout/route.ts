import { z } from 'zod';
import { database } from '@database/client';
import { rateLimit } from '@/lib/limits';
import { appUrl, pagBankApiUrl, pagBankPlans, pagBankToken } from '@/lib/pagbank';

const schema = z.object({
  cadastro: z.string().uuid(),
});

type OpeningLead = {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  plan: keyof typeof pagBankPlans;
  pagbankCheckoutId: string | null;
  pagbankCheckoutUrl: string | null;
  paymentStatus: string;
};

type CheckoutResponse = {
  id?: string;
  recurrence_plan?: { id?: string };
  links?: Array<{ rel?: string; href?: string }>;
  error_messages?: Array<{ description?: string }>;
};

export async function POST(request: Request) {
  try {
    const { cadastro } = schema.parse(await request.json());
    await rateLimit(`pagbank-checkout:${cadastro}`, 5);
    const leads = await database().$queryRaw<OpeningLead[]>`
      select * from concloud.get_opening_lead_for_checkout(${cadastro}::uuid)`;
    const lead = leads[0];
    if (!lead) return Response.json({ error: 'Cadastro não encontrado.' }, { status: 404 });
    if (lead.paymentStatus === 'PAID')
      return Response.json({ redirect: `/documentos-abertura?cadastro=${lead.id}` });
    if (lead.pagbankCheckoutId && lead.pagbankCheckoutUrl)
      return Response.json({ checkoutUrl: lead.pagbankCheckoutUrl });

    const plan = pagBankPlans[lead.plan];
    if (!plan) return Response.json({ error: 'Plano inválido.' }, { status: 400 });
    const baseUrl = appUrl();
    const callbackUrl = `${baseUrl}/api/pagbank/webhook`;
    const returnUrl = `${baseUrl}/pagamento/retorno?cadastro=${lead.id}`;
    const response = await fetch(pagBankApiUrl('/checkouts'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${pagBankToken()}`,
        'x-idempotency-key': `concloud${lead.id.replaceAll('-', '')}`,
      },
      body: JSON.stringify({
        reference_id: lead.id,
        customer: {
          name: lead.name,
          email: lead.email,
          tax_id: lead.cpf,
        },
        customer_modifiable: true,
        items: [
          { reference_id: lead.plan, name: plan.name, quantity: 1, unit_amount: plan.amount },
        ],
        payment_methods: [{ type: 'CREDIT_CARD' }],
        recurrence_plan: {
          name: `${plan.name} mensal`,
          interval: { unit: 'MONTH', length: 1 },
        },
        redirect_url: returnUrl,
        return_url: returnUrl,
        notification_urls: [callbackUrl],
        payment_notification_urls: [callbackUrl],
      }),
      cache: 'no-store',
    });
    const checkout = (await response.json()) as CheckoutResponse;
    const checkoutUrl = checkout.links?.find((link) => link.rel === 'PAY')?.href;
    if (!response.ok || !checkout.id || !checkoutUrl) {
      console.error(
        JSON.stringify({
          event: 'pagbank.checkout.failed',
          status: response.status,
          descriptions: checkout.error_messages?.map((item) => item.description),
        }),
      );
      return Response.json({ error: 'Não foi possível iniciar o pagamento.' }, { status: 502 });
    }
    await database().$executeRaw`
      select concloud.set_opening_lead_checkout(
        ${lead.id}::uuid, ${checkout.id}, ${checkoutUrl},
        ${checkout.recurrence_plan?.id ?? null}, ${plan.amount}
      )`;
    return Response.json({ checkoutUrl });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'pagbank.checkout.error',
        code: error instanceof z.ZodError ? 'INVALID_INPUT' : 'UNKNOWN',
      }),
    );
    return Response.json({ error: 'Pagamento temporariamente indisponível.' }, { status: 400 });
  }
}

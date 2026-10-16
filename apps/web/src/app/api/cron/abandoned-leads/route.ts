import { database } from '@database/client';
import { sendTransactionalEmail } from '@/lib/transactional-email';

type AbandonedLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  funnelStep: number;
  lastActivityAt: Date;
  marketingConsent: boolean;
  adminNotifiedAt: Date | null;
  recoveryEmail1At: Date | null;
  recoveryEmail2At: Date | null;
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[char]!,
  );

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const leads = await database().$queryRaw<AbandonedLead[]>`
      select * from concloud.get_abandoned_opening_leads()`;
    const adminEmail = process.env.ABANDONED_LEAD_NOTIFICATION_EMAIL;
    const pendingAdmin = leads.filter((lead) => !lead.adminNotifiedAt);
    if (adminEmail && pendingAdmin.length) {
      const rows = pendingAdmin
        .map(
          (lead) =>
            `<tr><td>${escapeHtml(lead.name)}</td><td>${escapeHtml(lead.email)}</td><td>${escapeHtml(lead.phone)}</td><td>${lead.funnelStep}/5</td></tr>`,
        )
        .join('');
      const result = await sendTransactionalEmail({
        to: adminEmail,
        subject: `${pendingAdmin.length} cadastro(s) de abertura não concluído(s)`,
        html: `<h2>Oportunidades para recuperar</h2><p>Estes clientes pararam há mais de uma hora.</p><table cellpadding="8" border="1"><tr><th>Nome</th><th>E-mail</th><th>Celular</th><th>Etapa</th></tr>${rows}</table>`,
      });
      if (result.sent) {
        for (const lead of pendingAdmin)
          await database().$executeRaw`
          select concloud.mark_opening_lead_followup(${lead.id}::uuid,true,0)`;
      }
    }

    const appUrl = process.env.APP_URL ?? 'https://concloud.vercel.app';
    let recoveries = 0;
    for (const lead of leads.filter((item) => item.marketingConsent)) {
      const hours = (Date.now() - new Date(lead.lastActivityAt).getTime()) / 3_600_000;
      const recoveryNumber = !lead.recoveryEmail1At
        ? 1
        : hours >= 24 && !lead.recoveryEmail2At
          ? 2
          : 0;
      if (!recoveryNumber) continue;
      const result = await sendTransactionalEmail({
        to: lead.email,
        subject:
          recoveryNumber === 1
            ? 'Seu cadastro da ConCloud ficou quase pronto'
            : 'Podemos ajudar a abrir sua empresa?',
        html: `<p>Olá, ${escapeHtml(lead.name)}.</p><p>Você parou na etapa ${lead.funnelStep} de 5 da abertura da sua empresa. Seu progresso continua disponível e nossa equipe pode ajudar.</p><p><a href="${appUrl}/abrir-empresa">Continuar abertura</a></p><p style="font-size:12px;color:#64748b">Você recebeu esta mensagem porque autorizou o contato durante o cadastro.</p>`,
      });
      if (result.sent) {
        await database()
          .$executeRaw`select concloud.mark_opening_lead_followup(${lead.id}::uuid,false,${recoveryNumber})`;
        recoveries++;
      }
    }
    return Response.json({ ok: true, found: leads.length, recoveries });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'opening.abandonment.failed',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      }),
    );
    return Response.json({ ok: false }, { status: 500 });
  }
}

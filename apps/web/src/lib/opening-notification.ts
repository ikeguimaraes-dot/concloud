import 'server-only';
import {
  markOpeningDocumentsNotified,
  openingProfileForUser,
  type OpeningProfile,
} from '@/lib/opening-resume';
import { sendTransactionalEmail } from '@/lib/transactional-email';
import { database } from '@database/client';

const paymentNotificationRecipients = [
  'ricardo@orkestri.net',
  'vitoria.mariano@oscpaulistana.com.br',
  'amanda.alves@oscpaulistana.com.br',
  'Igor.borges@oscpaulistana.com.br',
];

type PaidOpeningLead = {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  plan: string;
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!,
  );

const labels: Record<string, string> = {
  identidade: 'CNH ou RG do sócio',
  titulo: 'Título de Eleitor do sócio',
  'estado-civil': 'Comprovante de estado civil',
  'endereco-socio': 'Comprovante de endereço residencial',
  iptu: 'Capa do IPTU',
  'endereco-empresa': 'Comprovante de endereço do empreendimento',
};

function emailHtml(profile: OpeningProfile) {
  const row = (label: string, value: string) =>
    `<tr><th align="left" style="padding:8px;background:#fff4ec">${label}</th><td style="padding:8px">${escapeHtml(value || '—')}</td></tr>`;
  const documents = profile.documents
    .map(
      (document) =>
        `<li><strong>${escapeHtml(labels[document.kind] ?? document.kind)}</strong>: ${escapeHtml(document.filename)}</li>`,
    )
    .join('');
  return `<h2>Novo cadastro completo para abertura de empresa</h2>
    <table cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#eadfd8">
      ${row('Nome', profile.name)}${row('CPF', profile.cpf)}${row('E-mail', profile.email)}
      ${row('Celular', profile.phone)}${row('Atividade', profile.activity)}
      ${row('Endereço', `${profile.zipCode} · ${profile.city}/${profile.state}`)}
      ${row('Tipo de endereço', profile.addressType)}${row('Plano', profile.plan)}
      ${row('Pagamento', profile.paymentStatus)}
    </table>
    <h3>Documentos enviados</h3><ul>${documents}</ul>
    <p>Cadastro: ${escapeHtml(profile.id)}</p>`;
}

export async function notifyOpeningPaymentConfirmed(leadId: string) {
  const leads = await database().$queryRaw<PaidOpeningLead[]>`
    select id,name,cpf,email,phone,plan
    from concloud.get_opening_lead_for_checkout(${leadId}::uuid)`;
  const lead = leads[0];
  if (!lead) throw new Error('OPENING_LEAD_NOT_FOUND');
  const row = (label: string, value: string) =>
    `<tr><th align="left" style="padding:8px;background:#fff4ec">${label}</th><td style="padding:8px">${escapeHtml(value || '—')}</td></tr>`;
  return sendTransactionalEmail({
    to: paymentNotificationRecipients,
    subject: `Novo pagamento confirmado · ${lead.name}`,
    html: `<h2>Novo pagamento confirmado para abertura de empresa</h2>
      <table cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#eadfd8">
        ${row('Nome', lead.name)}${row('CPF', lead.cpf)}${row('E-mail', lead.email)}
        ${row('Celular', lead.phone)}${row('Plano', lead.plan)}${row('Pagamento', 'Confirmado')}
      </table>
      <p>Cadastro: ${escapeHtml(lead.id)}</p>`,
    idempotencyKey: `opening-payment-confirmed/${lead.id}`,
  });
}

export async function notifyOpeningDocumentsSubmitted(authUserId: string) {
  const profile = await openingProfileForUser(authUserId);
  if (!profile?.documentsSubmittedAt || profile.documentsNotifiedAt) return profile;
  const to =
    process.env.OPENING_COMPLETED_NOTIFICATION_EMAIL ??
    process.env.ABANDONED_LEAD_NOTIFICATION_EMAIL;
  if (!to) return profile;
  const result = await sendTransactionalEmail({
    to,
    subject: `Cadastro completo recebido · ${profile.name}`,
    html: emailHtml(profile),
  });
  if (result.sent) await markOpeningDocumentsNotified(profile.id, authUserId);
  return { ...profile, documentsNotifiedAt: result.sent ? new Date() : null };
}

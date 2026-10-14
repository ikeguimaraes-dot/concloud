import 'server-only';
import { database } from '@database/client';

export async function openingEmailByCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf)) return null;
  const rows = await database().$queryRaw<Array<{ email: string | null }>>`
    select concloud.get_opening_lead_email_by_cpf(${cpf}) as email`;
  return rows[0]?.email ?? null;
}

export async function openingResumeForUser(authUserId: string) {
  const rows = await database().$queryRaw<
    Array<{ id: string; plan: string; paymentStatus: string }>
  >`
    select id, plan, "paymentStatus"
    from concloud.get_opening_lead_resume(${authUserId}::uuid)`;
  return rows[0] ?? null;
}

export type OpeningDocument = {
  kind: string;
  filename: string;
  mime: string;
  size: number;
  uploadedAt: string;
};

export type OpeningProfile = {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  activity: string;
  zipCode: string;
  addressType: string;
  city: string;
  state: string;
  plan: string;
  paymentStatus: string;
  documentsSubmittedAt: Date | null;
  documentsNotifiedAt: Date | null;
  documents: OpeningDocument[];
};

export async function openingProfileForUser(authUserId: string) {
  const rows = await database().$queryRaw<OpeningProfile[]>`
    select * from concloud.get_opening_lead_profile(${authUserId}::uuid)`;
  return rows[0] ?? null;
}

export async function markOpeningDocumentsNotified(leadId: string, authUserId: string) {
  await database().$executeRaw`
    select concloud.mark_opening_lead_documents_notified(${leadId}::uuid, ${authUserId}::uuid)`;
}

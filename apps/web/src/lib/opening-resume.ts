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

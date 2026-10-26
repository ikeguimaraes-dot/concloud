import type { Tx } from '@database/client';
import { requiredDocumentKinds } from './opening-workflow';

type Lead = { id: string; plan: unknown; partnerCount: unknown };
export function documentProgress(plan: unknown, partnerCount: unknown, uploadedKinds: string[]) {
  if (
    !['mei', 'essencial', 'gestao', 'proximo'].includes(String(plan)) ||
    !Number.isInteger(partnerCount) ||
    Number(partnerCount) < 1
  )
    return { status: 'pending_details' as const };
  const required = requiredDocumentKinds(Number(partnerCount), plan === 'mei');
  const uploaded = required.filter((kind) => uploadedKinds.includes(kind)).length;
  return {
    status: 'available' as const,
    required: required.length,
    uploaded,
    missing: required.length - uploaded,
  };
}
export async function documentProgressForLeads(tx: Tx, leads: Lead[], canRead: boolean) {
  if (!canRead) return leads.map(() => ({ status: 'restricted' as const }));
  if (!leads.length) return [];
  // Metadata only. RLS applies to the lead, current file and immutable version.
  // Files tied to an earlier partner configuration do not fulfill current requirements.
  const docs = await tx.$queryRaw<{ leadId: string; kind: string }[]>`
    select d."openingLeadId" as "leadId",d.kind
    from concloud."OpeningLeadDocument" d
    join concloud."OpeningLead" l on l.id=d."openingLeadId"
    join concloud."OpeningDocumentVersion" v on v."documentId"=d.id and v."objectKey"=d."objectKey" and v."partnersSnapshot"=l.partners
    where l.id in (select value::uuid from jsonb_array_elements_text(${JSON.stringify(leads.map((l) => l.id))}::jsonb))`;
  return leads.map((lead) =>
    documentProgress(
      lead.plan,
      lead.partnerCount,
      docs.filter((d) => d.leadId === lead.id).map((d) => d.kind),
    ),
  );
}

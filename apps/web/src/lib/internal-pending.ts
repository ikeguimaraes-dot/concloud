import { z } from 'zod';
import type { Tx } from '@database/client';
import { AppError } from '@domain/errors';

export async function pendingWork(tx: Tx, request: Request, canReadDocuments: boolean) {
  if (!canReadDocuments)
    throw new AppError(
      'FORBIDDEN',
      'Seu perfil não permite consultar pendências documentais e tarefas.',
      403,
    );
  const input = z
    .object({
      ownerId: z.union([z.string().uuid(), z.literal(''), z.literal('unassigned')]).default(''),
      kind: z.enum(['ALL', 'DOCUMENTS', 'OVERDUE', 'DETAILS']).default('ALL'),
      search: z.string().trim().max(120).default(''),
      offset: z.coerce.number().int().min(0).max(100000).default(0),
    })
    .parse(Object.fromEntries(new URL(request.url).searchParams));
  type Row = {
    id: string;
    total: bigint;
    name: string;
    plan: string | null;
    ownerId: string | null;
    ownerName: string | null;
    processId: string | null;
    workflow: string | null;
    stage: number | null;
    testPayment: boolean;
    requiredDocs: number | null;
    missingDocs: number | null;
    overdueTasks: number;
    oldestDueAt: Date | null;
  };
  const rows = await tx.$queryRaw<Row[]>`
    with pending as (
      select l.id,l.name,l.plan,l."ownerId",s."displayName" as "ownerName",
        p.id as "processId",p.workflow,p.stage,
        coalesce(l."pagbankPaymentId"='TEST_BYPASS',false) as "testPayment",
        case when l.plan in ('mei','essencial','gestao','proximo') and jsonb_array_length(l.partners)>0 then docs.required else null end as "requiredDocs",
        case when l.plan in ('mei','essencial','gestao','proximo') and jsonb_array_length(l.partners)>0 then docs.missing else null end as "missingDocs",
        tasks.count as "overdueTasks",tasks."oldestDueAt"
      from concloud."OpeningLead" l
      left join concloud."OpeningProcess" p on p."leadId"=l.id
      left join concloud."OpeningStaff" s on s."userId"=l."ownerId" and s."organizationId"=l."organizationId"
      cross join lateral (
        select count(*)::integer as required,count(*) filter(where not exists(
          select 1 from concloud."OpeningLeadDocument" d join concloud."OpeningDocumentVersion" v on v."documentId"=d.id and v."objectKey"=d."objectKey" and v."partnersSnapshot"=l.partners
          where d."openingLeadId"=l.id and d.kind=k.kind
        ))::integer as missing
        from (
          select 'socio-'||i::text||'-'||kind as kind from generate_series(1,jsonb_array_length(l.partners)) i cross join unnest(array['identidade','titulo','estado-civil','endereco-socio']) kind
          union all select 'iptu' where l.plan<>'mei'
          union all select 'endereco-empresa'
        ) k
      ) docs
      cross join lateral (
        select count(*)::integer as count,min(t."dueAt") as "oldestDueAt" from concloud."OpeningProcessTask" t
        where t."processId"=p.id and not t.completed and t."dueAt"<current_timestamp
      ) tasks
      where (p.id is null or p.situation not in ('DONE','CANCELED'))
        and (${input.ownerId}='' or (${input.ownerId}='unassigned' and l."ownerId" is null) or l."ownerId"::text=${input.ownerId})
        and (${input.search}='' or position(lower(${input.search}) in lower(concat_ws(' ',l.name,l.email,l.cpf)))>0)
    ), filtered as (
      select * from pending where
        (${input.kind}='ALL' and ("missingDocs">0 or "missingDocs" is null or "overdueTasks">0))
        or (${input.kind}='DOCUMENTS' and "missingDocs">0)
        or (${input.kind}='OVERDUE' and "overdueTasks">0)
        or (${input.kind}='DETAILS' and "missingDocs" is null)
    )
    select *,count(*) over() as total from filtered
    order by ("overdueTasks">0) desc,"oldestDueAt" asc nulls last,"missingDocs" desc nulls last,id
    limit 51 offset ${input.offset}`;
  return {
    items: rows.slice(0, 50).map(({ total, ...row }) => ({ ...row, total: Number(total) })),
    nextOffset: rows.length > 50 ? input.offset + 50 : null,
    observedAt: new Date().toISOString(),
  };
}

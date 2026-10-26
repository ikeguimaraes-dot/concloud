import 'server-only';
import { operations } from './internal-operations';
import { documentProgressForLeads } from './opening-document-progress';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { transaction, type Actor, type Tx } from '@database/client';
import { AppError } from '@domain/errors';
import { bucket, signedDownload } from '@integrations/storage';
import { rateLimit } from './limits';

const uuid = z.string().uuid();
type Staff = {
  organizationId: string;
  userId: string;
  displayName: string;
  readAll: boolean;
  documents: boolean;
  canAssign: boolean;
  role: string;
};
type Lead = {
  id: string;
  organizationId: string;
  ownerId: string | null;
  version: number;
  createdAt: Date;
} & Record<string, unknown>;
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function internalActor(request: Request): Promise<Actor> {
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) throw new AppError('UNAUTHORIZED', 'Entre para acessar o painel.', 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new AppError('CONFIG', 'Autenticação indisponível.', 503);
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user?.email) throw new AppError('UNAUTHORIZED', 'Sua sessão expirou.', 401);
  const claims = await auth.auth.getClaims(token);
  if (claims.error || claims.data?.claims.sub !== data.user.id)
    throw new AppError('UNAUTHORIZED', 'Sessão inválida.', 401);
  const aal = claims.data.claims.aal ?? 'aal1';
  if (aal !== 'aal1' && aal !== 'aal2') throw new AppError('UNAUTHORIZED', 'Sessão inválida.', 401);
  return { id: data.user.id, email: data.user.email, aal };
}

async function staffContext(tx: Tx, actor: Actor) {
  await tx.$queryRaw`select set_config('app.aal',${actor.aal},true)`;
  const rows = await tx.$queryRaw<Staff[]>`
    select s.*, m.role::text from concloud."OpeningStaff" s
    join concloud."OrganizationMembership" m on m."organizationId"=s."organizationId" and m."userId"=s."userId"
    where s."userId"=${actor.id}::uuid and s."organizationId"=concloud.opening_office()
      and s.active and m.active and m.role in ('ORG_ADMIN','SUPER_ADMIN','ACCOUNTANT','ASSISTANT')`;
  const staff = rows[0];
  if (!staff)
    throw new AppError('FORBIDDEN', 'Seu acesso à equipe ConCloud ainda não está ativo.', 403);
  const admin = ['ORG_ADMIN', 'SUPER_ADMIN'].includes(staff.role);
  return {
    ...staff,
    readAll: staff.readAll || admin,
    documents: staff.documents || admin,
    canAssign: staff.canAssign || admin,
    admin,
  };
}
async function leadById(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<
    Lead[]
  >`select id,"organizationId","ownerId",version,name,cpf,email,phone,activity,"zipCode","addressType",city,state,plan,status,"createdAt","funnelStep","lastActivityAt",partners,"paymentStatus","paymentAmount","paidAt","paymentUpdatedAt","pagbankCheckoutId","pagbankPaymentId","pagbankSubscriptionId","documentsSubmittedAt" from concloud."OpeningLead" where id=${id}::uuid`;
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Cadastro não encontrado.', 404);
  return rows[0];
}
async function audit(
  tx: Tx,
  actor: Actor,
  lead: Lead,
  action: string,
  metadata: Record<string, unknown>,
) {
  await tx.$executeRaw`insert into concloud."OpeningAuditEvent"("organizationId","leadId","actorId",action,metadata) values(${lead.organizationId}::uuid,${lead.id}::uuid,${actor.id}::uuid,${action},${JSON.stringify(metadata)}::jsonb)`;
}
export async function internalOpening(request: Request, path: string[]) {
  try {
    const actor = await internalActor(request);
    await rateLimit(`internal:${actor.id}`, 120);
    const result = await transaction(actor, async (tx) => {
      const staff = await staffContext(tx, actor);
      const method = request.method;
      if (method === 'GET' && path.join('/') === 'me')
        return {
          user: { id: actor.id, email: actor.email, name: staff.displayName },
          permissions: {
            readAll: staff.readAll,
            documents: staff.documents,
            assign: staff.canAssign,
            admin: staff.admin,
          },
          office: 'ConCloud',
        };
      if (method === 'GET' && path.join('/') === 'staff') {
        if (!staff.canAssign) throw new AppError('FORBIDDEN', 'Atribuição não autorizada.', 403);
        // Staff visibility is restricted by RLS; only administrators manage the team in v1.
        const items = await tx.$queryRaw<
          { userId: string; displayName: string }[]
        >`select "userId","displayName" from concloud."OpeningStaff" where "organizationId"=${staff.organizationId}::uuid and active order by "displayName","userId"`;
        return { items };
      }
      if (path[0] === 'processes') return operations(tx, actor, staff, request, path);
      if (path[0] !== 'leads') throw new AppError('NOT_FOUND', 'Recurso não encontrado.', 404);
      if (path.length === 1 && method === 'GET') {
        const params = new URL(request.url).searchParams;
        const input = z
          .object({
            search: z.string().trim().max(120).default(''),
            plan: z.enum(['', 'mei', 'essencial', 'gestao', 'proximo']).default(''),
            status: z.enum(['', 'DRAFT', 'NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED']).default(''),
            paymentStatus: z
              .enum([
                '',
                'PENDING',
                'WAITING',
                'IN_ANALYSIS',
                'PAID',
                'DECLINED',
                'CANCELED',
                'EXPIRED',
              ])
              .default(''),
            ownerId: z.union([uuid, z.literal(''), z.literal('unassigned')]).default(''),
            limit: z.coerce.number().int().min(1).max(100).default(25),
            cursor: z.string().max(2000).optional(),
          })
          .parse(Object.fromEntries(params));
        const filter = JSON.stringify([
          input.search,
          input.plan,
          input.status,
          input.paymentStatus,
          input.ownerId,
        ]);
        let cursor: { createdAt: string; id: string; filter: string } | null = null;
        if (input.cursor) {
          try {
            cursor = z
              .object({ createdAt: z.string().datetime(), id: uuid, filter: z.string() })
              .parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString()));
          } catch {
            throw new AppError('INVALID_CURSOR', 'Paginação inválida.', 422);
          }
          if (cursor.filter !== filter)
            throw new AppError('INVALID_CURSOR', 'Atualize a busca.', 422);
        }
        const search = `%${input.search.replace(/[\\%_]/g, '\\$&')}%`;
        const cpfSearch = /^[\d.\-\s]+$/.test(input.search) ? input.search.replace(/\D/g, '') : '';
        const rows = await tx.$queryRaw<(Lead & { plan: string | null; partnerCount: number })[]>`
        select jsonb_array_length(partners) as "partnerCount",id,name,email,phone,plan,status,"funnelStep","lastActivityAt","createdAt","paymentStatus","paymentAmount","paidAt","pagbankCheckoutId","ownerId",version,
        case when exists(select 1 from concloud."OpeningProcess" p where p."leadId"=concloud."OpeningLead".id) then 'OPERATION' when "paymentStatus"='PAID' then 'PAID' when status='DRAFT' then 'STARTED' when "pagbankCheckoutId" is not null then 'WAITING_PAYMENT' else 'REGISTERED' end as "commercialStage", coalesce("pagbankPaymentId"='TEST_BYPASS',false) as "testPayment"
        from concloud."OpeningLead"
        where (${input.search}='' or name ilike ${search} or email ilike ${search} or (${cpfSearch}<>'' and cpf like ${`%${cpfSearch}%`}))
        and (${input.plan}='' or plan=${input.plan}) and (${input.status}='' or status=${input.status})
        and (${input.paymentStatus}='' or "paymentStatus"=${input.paymentStatus})
        and (${input.ownerId}='' or (${input.ownerId}='unassigned' and "ownerId" is null) or "ownerId"::text=${input.ownerId})
        and (${cursor?.id ?? null}::uuid is null or ("createdAt",id)<(${cursor?.createdAt ?? null}::timestamp,${cursor?.id ?? null}::uuid))
        order by "createdAt" desc,id desc limit ${input.limit + 1}`;
        const items = rows.slice(0, input.limit),
          last = items.at(-1);
        const nextCursor =
          rows.length > input.limit && last
            ? Buffer.from(
                JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id, filter }),
              ).toString('base64url')
            : null;
        const progress = await documentProgressForLeads(tx, items, staff.documents);
        return {
          items: items.map((lead, index) => ({
            ...lead,
            documentProgress: progress[index],
          })),
          nextCursor,
          observedAt: new Date().toISOString(),
        };
      }
      const id = uuid.parse(path[1]);
      const lead = await leadById(tx, id);
      if (path.length === 2 && method === 'GET') {
        const events = await tx.$queryRaw<
          Record<string, unknown>[]
        >`select id,action,"actorId",metadata,"createdAt" from concloud."OpeningAuditEvent" where "leadId"=${id}::uuid order by "createdAt" desc,id desc limit 30`;
        return { ...lead, events };
      }
      if (path.length === 3 && path[2] === 'assignment' && method === 'PATCH') {
        if (!staff.canAssign)
          throw new AppError('FORBIDDEN', 'Você não pode atribuir cadastros.', 403);
        const input = z
          .object({ ownerId: uuid.nullable(), expectedVersion: z.number().int().positive() })
          .strict()
          .parse(await request.json());
        if (input.ownerId) {
          // An active organization membership is checked by the target's staff grant on each use.
          const target = await tx.$queryRaw<
            { userId: string }[]
          >`select "userId" from concloud."OpeningStaff" where "organizationId"=${staff.organizationId}::uuid and "userId"=${input.ownerId}::uuid and active`;
          if (!target[0])
            throw new AppError('INVALID_OWNER', 'Responsável não disponível nesta equipe.', 422);
        }
        const changed = await tx.$queryRaw<
          Lead[]
        >`update concloud."OpeningLead" set "ownerId"=${input.ownerId}::uuid,version=version+1 where id=${id}::uuid and version=${input.expectedVersion} returning id,version,"ownerId"`;
        if (!changed[0])
          throw new AppError(
            'CONFLICT',
            'Outro operador alterou este cadastro. Atualize a ficha.',
            409,
          );
        await audit(tx, actor, lead, 'lead.assigned', {
          previousOwnerId: lead.ownerId,
          ownerId: input.ownerId,
          version: changed[0].version,
        });
        return changed[0];
      }
      if (path[2] === 'documents') {
        if (!staff.documents)
          throw new AppError('FORBIDDEN', 'Acesso aos documentos não autorizado.', 403);
        if (path.length === 5 && path[4] === 'versions' && method === 'GET') {
          const documentId = uuid.parse(path[3]);
          const items =
            await tx.$queryRaw`select v.id,v.filename,v."uploadedAt",(v."objectKey"=d."objectKey") as current,
            coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'decision',r.decision,'reason',r.reason,'createdAt',r."createdAt") order by r."createdAt" desc,r.id desc) from concloud."OpeningDocumentReview" r where r."versionId"=v.id),'[]'::jsonb) as reviews
            from concloud."OpeningDocumentVersion" v join concloud."OpeningLeadDocument" d on d.id=v."documentId"
            where v."documentId"=${documentId}::uuid and v."leadId"=${id}::uuid order by v."uploadedAt" desc,v.id desc limit 100`;
          return { items };
        }
        if (
          path.length === 7 &&
          path[4] === 'versions' &&
          path[6] === 'download' &&
          method === 'POST'
        ) {
          const documentId = uuid.parse(path[3]),
            versionId = uuid.parse(path[5]);
          const [doc] = await tx.$queryRaw<
            { objectKey: string; bucket: string }[]
          >`select "objectKey",bucket from concloud."OpeningDocumentVersion" where id=${versionId}::uuid and "documentId"=${documentId}::uuid and "leadId"=${id}::uuid`;
          if (!doc || doc.bucket !== bucket() || !doc.objectKey.startsWith(`opening-leads/${id}/`))
            throw new AppError('NOT_FOUND', 'Versão não encontrada.', 404);
          await audit(tx, actor, lead, 'document.version_download_authorized', {
            documentId,
            versionId,
          });
          return { url: await signedDownload(doc.objectKey) };
        }
        if (path.length === 5 && path[4] === 'reviews' && method === 'POST') {
          const documentId = uuid.parse(path[3]);
          const input = z
            .object({
              versionId: uuid,
              expectedReviewId: uuid.nullable(),
              decision: z.enum(['APPROVED', 'REJECTED']),
              reason: z.string().trim().max(2000).default(''),
            })
            .strict()
            .parse(await request.json());
          if (input.decision === 'REJECTED' && input.reason.length < 5)
            throw new AppError(
              'REASON_REQUIRED',
              'Informe o motivo da correção (mínimo 5 caracteres).',
              422,
            );
          const current = await tx.$queryRaw<
            { id: string }[]
          >`select id from concloud."OpeningLeadDocument" where id=${documentId}::uuid and "openingLeadId"=${id}::uuid`;
          if (!current[0]) throw new AppError('NOT_FOUND', 'Documento não encontrado.', 404);
          const versions = await tx.$queryRaw<{ id: string; reviewId: string | null }[]>`
            select v.id,r.id as "reviewId" from concloud."OpeningDocumentVersion" v
            join concloud."OpeningLeadDocument" d on d.id=v."documentId" and d."objectKey"=v."objectKey"
            left join lateral(select id from concloud."OpeningDocumentReview" where "versionId"=v.id order by "createdAt" desc,id desc limit 1) r on true
            where d.id=${documentId}::uuid and v.id=${input.versionId}::uuid and v."partnersSnapshot"=${JSON.stringify(lead.partners)}::jsonb`;
          if (!versions[0] || versions[0].reviewId !== input.expectedReviewId)
            throw new AppError(
              'CONFLICT',
              'O documento, os sócios ou sua revisão mudaram. Atualize a ficha.',
              409,
            );
          const [review] = await tx.$queryRaw<
            { id: string }[]
          >`insert into concloud."OpeningDocumentReview"("versionId","reviewerId",decision,reason) values(${input.versionId}::uuid,${actor.id}::uuid,${input.decision},${input.reason}) returning id`;
          await audit(tx, actor, lead, 'document.reviewed', {
            documentId,
            versionId: input.versionId,
            reviewId: review.id,
            decision: input.decision,
          });
          return { ok: true };
        }
        if (path.length === 3 && method === 'GET') {
          const items = await tx.$queryRaw<
            Record<string, unknown>[]
          >`select d.id,d.kind,d.filename,d.mime,d.size,d."uploadedAt",v.id as "versionId",r.id as "reviewId",coalesce(r.decision,'RECEIVED') as decision,coalesce(r.reason,'') as reason,
            (v."partnersSnapshot"=l.partners) as "matchesPartners"
            from concloud."OpeningLeadDocument" d join concloud."OpeningLead" l on l.id=d."openingLeadId"
            join concloud."OpeningDocumentVersion" v on v."documentId"=d.id and v."objectKey"=d."objectKey"
            left join lateral(select id,decision,reason from concloud."OpeningDocumentReview" where "versionId"=v.id order by "createdAt" desc,id desc limit 1) r on true
            where d."openingLeadId"=${id}::uuid order by d.kind`;
          return { items, submittedAt: lead.documentsSubmittedAt };
        }
        if (path.length === 5 && path[4] === 'download' && method === 'POST') {
          const docId = uuid.parse(path[3]);
          const docs = await tx.$queryRaw<
            { id: string; objectKey: string; bucket: string }[]
          >`select id,"objectKey",bucket from concloud."OpeningLeadDocument" where id=${docId}::uuid and "openingLeadId"=${id}::uuid`;
          const doc = docs[0];
          if (!doc || doc.bucket !== bucket() || !doc.objectKey.startsWith(`opening-leads/${id}/`))
            throw new AppError('NOT_FOUND', 'Arquivo não encontrado.', 404);
          const url = await signedDownload(doc.objectKey);
          await audit(tx, actor, lead, 'document.download_authorized', { documentId: doc.id });
          return { url, expiresAt: new Date(Date.now() + 60000).toISOString() };
        }
      }
      throw new AppError('NOT_FOUND', 'Recurso não encontrado.', 404);
    });
    return Response.json(result, { headers });
  } catch (error) {
    const correlationId = crypto.randomUUID();
    if (error instanceof AppError)
      return Response.json(
        { error: { code: error.code, message: error.message, correlationId } },
        { status: error.status, headers },
      );
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'Revise os filtros e os dados enviados.',
            correlationId,
          },
        },
        { status: 422, headers },
      );
    const conflict =
      error && typeof error === 'object' && 'code' in error && error.code === 'P2034';
    console.error(
      JSON.stringify({
        event: 'internal.opening.failed',
        correlationId,
        code: conflict ? 'CONFLICT' : 'INTERNAL_ERROR',
      }),
    );
    return Response.json(
      {
        error: {
          code: conflict ? 'CONFLICT' : 'UNAVAILABLE',
          message: conflict
            ? 'Atualize a ficha antes de tentar novamente.'
            : 'Não foi possível consultar o serviço. Tente novamente.',
          correlationId,
        },
      },
      { status: conflict ? 409 : 503, headers },
    );
  }
}

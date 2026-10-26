import 'server-only';
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
  if (claims.data.claims.aal !== 'aal2')
    throw new AppError('MFA_REQUIRED', 'Confirme a autenticação em duas etapas.', 403);
  return { id: data.user.id, email: data.user.email, aal: 'aal2' };
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
        const rows = await tx.$queryRaw<Lead[]>`
        select id,name,email,phone,plan,status,"funnelStep","lastActivityAt","createdAt","paymentStatus","paymentAmount","paidAt","pagbankCheckoutId","ownerId",version
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
        return { items, nextCursor, observedAt: new Date().toISOString() };
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
        if (path.length === 3 && method === 'GET') {
          const items = await tx.$queryRaw<
            Record<string, unknown>[]
          >`select id,kind,filename,mime,size,"uploadedAt" from concloud."OpeningLeadDocument" where "openingLeadId"=${id}::uuid order by kind`;
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

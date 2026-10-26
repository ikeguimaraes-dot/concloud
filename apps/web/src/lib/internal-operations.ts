import 'server-only';
import { z } from 'zod';
import type { Actor, Tx } from '@database/client';
import { AppError } from '@domain/errors';
import { validCnpj, normalizeCnpj } from '@domain/cnpj';
import { bucket, putObject, validateUpload, signedDownload } from '@integrations/storage';
import { workflows, returns, allowedTransition, requiredDocumentKinds } from './opening-workflow';
const uuid = z.string().uuid();
const situation = z.enum([
  'TODO',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'WAITING_AGENCY',
  'REQUIREMENT',
  'DONE',
  'CANCELED',
]);
type Process = {
  id: string;
  leadId: string;
  workflow: keyof typeof workflows;
  stage: number;
  situation: string;
  version: number;
  ownerId: string | null;
  plan: string;
  state: string;
  partners: unknown[];
  paymentStatus: string;
};
export async function operations(
  tx: Tx,
  actor: Actor,
  staff: { documents: boolean; canAssign: boolean },
  request: Request,
  path: string[],
) {
  const method = request.method;
  if (path.length === 1 && method === 'GET') {
    const params = new URL(request.url).searchParams;
    const input = z
      .object({
        workflow: z.enum(['', 'MEI', 'JUCESP']).default(''),
        offset: z.coerce.number().int().min(0).max(100000).default(0),
      })
      .parse(Object.fromEntries(params));
    const items = await tx.$queryRaw<
      Process[]
    >`select p.*,l.name,l.plan,l."ownerId",l."paymentStatus",(select s."displayName" from concloud."OpeningStaff" s where s."userId"=l."ownerId" and s."organizationId"=l."organizationId") as "ownerName" from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where (${input.workflow}='' or p.workflow=${input.workflow}) order by p."createdAt" desc,p.id desc limit 51 offset ${input.offset}`;
    return {
      items: items.slice(0, 50),
      nextOffset: items.length > 50 ? input.offset + 50 : null,
      workflows,
      returns,
    };
  }
  if (path.length === 1 && method === 'POST') {
    if (!staff.canAssign || !staff.documents)
      throw new AppError(
        'FORBIDDEN',
        'Encaminhamento reservado à equipe com atribuição e documentos.',
        403,
      );
    const input = z
      .object({ leadId: uuid, workflow: z.enum(['MEI', 'JUCESP']) })
      .strict()
      .parse(await request.json());
    const [lead] = await tx.$queryRaw<
      {
        plan: string;
        ownerId: string | null;
        paymentStatus: string;
        state: string;
        status: string;
      }[]
    >`select plan,"ownerId","paymentStatus",state,status from concloud."OpeningLead" where id=${input.leadId}::uuid`;
    if (!lead) throw new AppError('NOT_FOUND', 'Cadastro não encontrado.', 404);
    if (lead.paymentStatus !== 'PAID' || !lead.ownerId || lead.status === 'DRAFT')
      throw new AppError(
        'BLOCKED',
        'Conclua o cadastro, confirme o pagamento e atribua um responsável antes de encaminhar.',
        422,
      );
    if (
      (input.workflow === 'MEI') !== (lead.plan === 'mei') ||
      (input.workflow === 'JUCESP' && lead.state.toUpperCase() !== 'SP')
    )
      throw new AppError(
        'ROUTE',
        'Escolha MEI para plano MEI ou JUCESP para pequena empresa em SP. Outras rotas dependem de definição.',
        422,
      );
    const created = await tx.$queryRaw<
      Process[]
    >`insert into concloud."OpeningProcess"("leadId",workflow) values(${input.leadId}::uuid,${input.workflow}) on conflict("leadId") do nothing returning *`;
    if (created[0])
      await tx.$executeRaw`insert into concloud."OpeningProcessEvent"("processId","actorId","toStage",situation,reason) values(${created[0].id}::uuid,${actor.id}::uuid,1,'TODO','Encaminhamento manual após pagamento confirmado')`;
    const [process] = await tx.$queryRaw<
      Process[]
    >`select * from concloud."OpeningProcess" where "leadId"=${input.leadId}::uuid`;
    if (process.workflow !== input.workflow)
      throw new AppError('CONFLICT', 'Este cadastro já possui processo em outra rota.', 409);
    return process;
  }
  const id = uuid.parse(path[1]);
  const [p] = await tx.$queryRaw<
    Process[]
  >`select p.*,l."ownerId",l.plan,l.state,l.partners,l."paymentStatus" from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id=${id}::uuid`;
  if (!p) throw new AppError('NOT_FOUND', 'Processo não encontrado.', 404);
  if (!staff.documents)
    throw new AppError('FORBIDDEN', 'Seu perfil não permite operar documentos e etapas.', 403);
  if (path.length === 2 && method === 'GET') {
    const events =
      await tx.$queryRaw`select * from concloud."OpeningProcessEvent" where "processId"=${id}::uuid order by "createdAt" desc,id desc limit 100`;
    const tasks =
      await tx.$queryRaw`select * from concloud."OpeningProcessTask" where "processId"=${id}::uuid order by completed,"dueAt" nulls last,id limit 100`;
    const evidence =
      await tx.$queryRaw`select id,kind,filename,"createdAt" from concloud."OpeningProcessEvidence" where "processId"=${id}::uuid order by "createdAt" desc limit 100`;
    return {
      ...p,
      events,
      tasks,
      evidence,
      stages: workflows[p.workflow],
      returnStage: p.workflow === 'JUCESP' ? returns[p.stage] : p.stage > 1 ? p.stage - 1 : null,
    };
  }
  if (path.length === 3 && path[2] === 'transitions' && method === 'POST') {
    const input = z
      .object({
        targetStage: z.number().int().min(1).max(16),
        expectedVersion: z.number().int().positive(),
        situation,
        reason: z.string().trim().min(5).max(2000),
        checked: z.boolean().default(false),
        protocol: z.string().trim().max(200).default(''),
        cnpj: z.string().max(24).default(''),
      })
      .strict()
      .parse(await request.json());
    if (p.version !== input.expectedVersion)
      throw new AppError('CONFLICT', 'Outro operador alterou o processo. Atualize o quadro.', 409);
    if (p.situation === 'DONE' || p.situation === 'CANCELED')
      throw new AppError(
        'CLOSED',
        'Processo encerrado. Reabertura precisa de análise administrativa.',
        422,
      );
    const moving = input.targetStage !== p.stage;
    if (moving && !allowedTransition(p.workflow, p.stage, input.targetStage))
      throw new AppError('TRANSITION', 'Avance uma etapa por vez ou use o retorno previsto.', 422);
    if (
      input.targetStage < p.stage &&
      [4, 6, 8, 13].includes(p.stage) &&
      p.workflow === 'JUCESP' &&
      !input.protocol
    )
      throw new AppError(
        'BLOCKED',
        'Registre o protocolo ou referência da exigência/negativa.',
        422,
      );
    const forward = input.targetStage > p.stage;
    const finishing = input.situation === 'DONE';
    if (finishing && (p.stage !== workflows[p.workflow].length || moving))
      throw new AppError('BLOCKED', 'Conclua as etapas antes de encerrar.', 422);
    if (forward || finishing) {
      if (!input.checked)
        throw new AppError('BLOCKED', 'Confirme o checklist da etapa atual.', 422);
      const needsDocs = p.workflow === 'JUCESP' || p.stage >= 2;
      if (needsDocs) {
        const approved = await tx.$queryRaw<
          { kind: string }[]
        >`select d.kind from concloud."OpeningLeadDocument" d join concloud."OpeningDocumentVersion" v on v."documentId"=d.id and v."objectKey"=d."objectKey" join lateral(select decision from concloud."OpeningDocumentReview" where "versionId"=v.id order by "createdAt" desc,id desc limit 1) r on true where d."openingLeadId"=${p.leadId}::uuid and r.decision='APPROVED' and v."partnersSnapshot"=${JSON.stringify(p.partners)}::jsonb`;
        const missing = requiredDocumentKinds(p.partners.length, p.workflow === 'MEI').filter(
          (k) => !approved.some((d) => d.kind === k),
        );
        if (!p.partners.length || missing.length)
          throw new AppError(
            'BLOCKED',
            `Documentos pendentes de aprovação: ${missing.join(', ') || 'titular/sócios'}.`,
            422,
          );
      }
      if (p.workflow === 'JUCESP' && [3, 5, 7, 12].includes(p.stage) && !input.protocol)
        throw new AppError('BLOCKED', 'Registre o número do protocolo/recibo.', 422);
      if ((p.workflow === 'JUCESP' && p.stage === 14) || (p.workflow === 'MEI' && p.stage === 5)) {
        if (!validCnpj(normalizeCnpj(input.cnpj)))
          throw new AppError('BLOCKED', 'Informe um CNPJ válido conferido pela equipe.', 422);
      }
      const required =
        p.workflow === 'JUCESP'
          ? p.stage === 11
            ? ['DARE', 'SIGNED_CONTRACT']
            : p.stage === 14
              ? ['CNPJ']
              : finishing
                ? ['DELIVERY']
                : []
          : p.stage === 5
            ? ['CNPJ', 'CCMEI']
            : p.stage === 6 || finishing
              ? ['DELIVERY']
              : [];
      const evidence = await tx.$queryRaw<
        { kind: string }[]
      >`select kind from concloud."OpeningProcessEvidence" e where "processId"=${id}::uuid and (kind<>'SIGNED_CONTRACT' or "createdAt">coalesce((select max("createdAt") from concloud."OpeningProcessEvent" where "processId"=${id}::uuid and "toStage"<"fromStage"),'-infinity'::timestamptz))`;
      if (required.some((k) => !evidence.some((e) => e.kind === k)))
        throw new AppError('BLOCKED', `Anexe os comprovantes: ${required.join(', ')}.`, 422);
      if (finishing) {
        const [{ count }] = await tx.$queryRaw<
          { count: bigint }[]
        >`select count(*) as count from concloud."OpeningProcessTask" where "processId"=${id}::uuid and not completed`;
        if (Number(count) > 0)
          throw new AppError('BLOCKED', 'Conclua as tarefas pendentes antes do encerramento.', 422);
      }
    }
    const changed = await tx.$queryRaw<
      Process[]
    >`update concloud."OpeningProcess" set stage=${input.targetStage},situation=${input.situation},version=version+1 where id=${id}::uuid and version=${input.expectedVersion} returning *`;
    if (!changed[0]) throw new AppError('CONFLICT', 'Atualize o processo.', 409);
    await tx.$executeRaw`insert into concloud."OpeningProcessEvent"("processId","actorId","fromStage","toStage",situation,reason,evidence) values(${id}::uuid,${actor.id}::uuid,${p.stage},${input.targetStage},${input.situation},${input.reason},${JSON.stringify({ checked: input.checked, protocol: input.protocol, cnpj: input.cnpj, workflowVersion: 1 })}::jsonb)`;
    return changed[0];
  }
  if (path[2] === 'tasks' && path.length === 3 && method === 'POST') {
    const input = z
      .object({ title: z.string().trim().min(3).max(200), dueAt: z.string().datetime().nullable() })
      .strict()
      .parse(await request.json());
    if (!p.ownerId) throw new AppError('BLOCKED', 'Atribua um responsável ao cadastro.', 422);
    const [task] = await tx.$queryRaw<
      Record<string, unknown>[]
    >`insert into concloud."OpeningProcessTask"("processId",title,"ownerId","dueAt") values(${id}::uuid,${input.title},${p.ownerId}::uuid,${input.dueAt}::timestamptz) returning *`;
    await tx.$executeRaw`insert into concloud."OpeningProcessEvent"("processId","actorId","fromStage","toStage",situation,reason) values(${id}::uuid,${actor.id}::uuid,${p.stage},${p.stage},${p.situation},${'Tarefa criada: ' + input.title})`;
    return task;
  }
  if (path[2] === 'tasks' && path.length === 4 && method === 'PATCH') {
    const taskId = uuid.parse(path[3]);
    const input = z
      .object({ completed: z.boolean(), expectedVersion: z.number().int().positive() })
      .strict()
      .parse(await request.json());
    const rows = await tx.$queryRaw<
      { title: string }[]
    >`update concloud."OpeningProcessTask" set completed=${input.completed},version=version+1 where id=${taskId}::uuid and "processId"=${id}::uuid and version=${input.expectedVersion} returning title`;
    if (!rows[0]) throw new AppError('CONFLICT', 'Atualize as tarefas.', 409);
    await tx.$executeRaw`insert into concloud."OpeningProcessEvent"("processId","actorId","fromStage","toStage",situation,reason) values(${id}::uuid,${actor.id}::uuid,${p.stage},${p.stage},${p.situation},${'Tarefa ' + (input.completed ? 'concluída: ' : 'reaberta: ') + rows[0].title})`;
    return { ok: true };
  }
  if (path[2] === 'evidence' && path.length === 3 && method === 'POST') {
    const input = z
      .object({
        kind: z.enum(['DARE', 'SIGNED_CONTRACT', 'CNPJ', 'CCMEI', 'DELIVERY', 'OTHER']),
        filename: z.string().min(1).max(255),
        mime: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
        data: z.string().max(2800000),
      })
      .strict()
      .parse(await request.json());
    const bytes = Buffer.from(input.data, 'base64');
    if (bytes.length > 2 * 1024 * 1024) throw new AppError('SIZE', 'Anexo de até 2 MB.', 413);
    validateUpload(bytes, input.mime);
    const objectKey = `opening-processes/${id}/${crypto.randomUUID()}`;
    await putObject(objectKey, bytes, input.mime);
    await tx.$executeRaw`insert into concloud."OpeningProcessEvidence"("processId","actorId",kind,filename,mime,size,bucket,"objectKey") values(${id}::uuid,${actor.id}::uuid,${input.kind},${input.filename},${input.mime},${bytes.length},${bucket()},${objectKey})`;
    return { ok: true };
  }
  if (path[2] === 'evidence' && path.length === 5 && path[4] === 'download' && method === 'POST') {
    const evidenceId = uuid.parse(path[3]);
    const [e] = await tx.$queryRaw<
      { objectKey: string; bucket: string }[]
    >`select "objectKey",bucket from concloud."OpeningProcessEvidence" where id=${evidenceId}::uuid and "processId"=${id}::uuid`;
    if (!e || e.bucket !== bucket() || !e.objectKey.startsWith(`opening-processes/${id}/`))
      throw new AppError('NOT_FOUND', 'Anexo não encontrado.', 404);
    await tx.$executeRaw`insert into concloud."OpeningProcessEvent"("processId","actorId","fromStage","toStage",situation,reason,evidence) values(${id}::uuid,${actor.id}::uuid,${p.stage},${p.stage},${p.situation},'Download autorizado',${JSON.stringify({ evidenceId })}::jsonb)`;
    return { url: await signedDownload(e.objectKey) };
  }
  throw new AppError('NOT_FOUND', 'Recurso não encontrado.', 404);
}

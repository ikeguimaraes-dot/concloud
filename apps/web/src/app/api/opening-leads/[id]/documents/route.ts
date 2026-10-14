import { z } from 'zod';
import { database } from '@database/client';
import { bucket, putObject, validateUpload } from '@integrations/storage';
import { currentActor } from '@/lib/auth';
import { rateLimit } from '@/lib/limits';

const kinds = [
  'identidade',
  'titulo',
  'estado-civil',
  'endereco-socio',
  'iptu',
  'endereco-empresa',
] as const;

async function context(params: Promise<{ id: string }>) {
  const actor = await currentActor();
  if (!actor) throw new Error('UNAUTHORIZED');
  const id = z
    .string()
    .uuid()
    .parse((await params).id);
  return { actor, id };
}

async function status(id: string, actorId: string) {
  return database().$queryRaw<Array<{ kind: string | null; submittedAt: Date | null }>>`
    select kind, "submittedAt"
    from concloud.get_opening_lead_document_status(${id}::uuid, ${actorId}::uuid)`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, id } = await context(params);
    await rateLimit(`opening-documents-status:${actor.id}`, 30);
    const rows = await status(id, actor.id);
    if (!rows.length) return Response.json({ error: 'Cadastro não autorizado.' }, { status: 404 });
    return Response.json({
      uploaded: rows.flatMap((row) => (row.kind ? [row.kind] : [])),
      submitted: Boolean(rows[0]?.submittedAt),
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      {
        error: unauthorized
          ? 'Faça login para continuar.'
          : 'Não foi possível consultar os documentos.',
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, id } = await context(params);
    if (request.headers.get('origin') !== new URL(request.url).origin)
      return Response.json({ error: 'Origem não autorizada.' }, { status: 403 });
    await rateLimit(`opening-documents-upload:${actor.id}`, 8);
    const before = await status(id, actor.id);
    if (!before.length)
      return Response.json({ error: 'Cadastro não autorizado.' }, { status: 404 });

    const form = await request.formData();
    for (const kind of kinds) {
      const value = form.get(kind);
      if (!(value instanceof File) || value.size === 0) continue;
      const bytes = new Uint8Array(await value.arrayBuffer());
      validateUpload(bytes, value.type);
      const objectKey = `opening-leads/${id}/${kind}/${crypto.randomUUID()}`;
      await putObject(objectKey, bytes, value.type);
      await database().$executeRaw`
        select concloud.save_opening_lead_document(
          ${id}::uuid, ${actor.id}::uuid, ${kind}, ${value.name.slice(0, 255)},
          ${value.type}, ${bytes.length}, ${bucket()}, ${objectKey}
        )`;
    }

    const rows = await status(id, actor.id);
    const uploaded = new Set(rows.flatMap((row) => (row.kind ? [row.kind] : [])));
    if (kinds.some((kind) => !uploaded.has(kind)))
      return Response.json(
        { error: 'Envie todos os documentos antes de finalizar.', uploaded: [...uploaded] },
        { status: 400 },
      );
    await database().$executeRaw`
      select concloud.complete_opening_lead_documents(${id}::uuid, ${actor.id}::uuid)`;
    return Response.json({ ok: true, uploaded: [...uploaded], submitted: true });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'UNAUTHORIZED';
    const message = error instanceof Error ? error.message : '';
    const validation = message.includes('até 10 MB') || message.includes('Tipo inválido');
    return Response.json(
      {
        error: unauthorized
          ? 'Faça login para continuar.'
          : validation
            ? message
            : 'Não foi possível enviar os documentos. Tente novamente.',
      },
      { status: unauthorized ? 401 : validation ? 400 : 500 },
    );
  }
}

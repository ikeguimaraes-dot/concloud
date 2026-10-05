import { requireActor } from '@/lib/auth';
import { verifyLocalToken, readObject, localStorage } from '@integrations/storage';
import { scoped, tenant } from '@database/client';
import { internal } from '@domain/permissions';
export async function GET(request: Request) {
  if (!localStorage()) return new Response(null, { status: 404 });
  const actor = await requireActor();
  try {
    const key = verifyLocalToken(new URL(request.url).searchParams.get('token') ?? '');
    const companyId = key.split('/')[1];
    await scoped(actor, companyId, 'read', async (tx, s) => {
      const version = await tx.documentVersion.findFirst({
        where: { ...tenant(s), objectKey: key },
      });
      const batch = internal(s.role)
        ? await tx.exportBatch.findFirst({
            where: { ...tenant(s), objectKey: key, status: 'READY' },
          })
        : null;
      if (!version && !batch) throw new Error('Não autorizado');
    });
    const bytes = await readObject(key);
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': key.endsWith('.zip') ? 'application/zip' : 'application/octet-stream',
        'Content-Disposition': 'attachment',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Arquivo indisponível.', { status: 404 });
  }
}

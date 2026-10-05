import { requireActor } from '@/lib/auth';
import { downloadDocument } from '@/lib/service';
import { AppError } from '@domain/errors';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string; documentId: string }> },
) {
  const actor = await requireActor();
  const { companyId, documentId } = await params;
  try {
    return Response.redirect(
      new URL(await downloadDocument(actor, companyId, documentId), request.url),
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof AppError ? e.message : 'Documento indisponível.' },
      { status: e instanceof AppError ? e.status : 404 },
    );
  }
}

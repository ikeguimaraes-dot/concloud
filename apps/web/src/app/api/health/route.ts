import { database } from '@database/client';
import { redis } from '@/lib/limits';
export async function GET() {
  try {
    await Promise.all([database().$queryRaw`SELECT 1`, redis().ping()]);
    return Response.json({ ok: true, service: 'concloud-web' });
  } catch {
    return Response.json({ ok: false, service: 'concloud-web' }, { status: 503 });
  }
}

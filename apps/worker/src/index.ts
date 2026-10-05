import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { Pool } from 'pg';
import { createServer } from 'node:http';
import { scoped, tenant, audit, type Actor } from '../../../packages/database/client';
import {
  ManualAccountingAdapter,
  type Snapshot,
} from '../../../packages/integrations/src/accounting';
import { readObject, putObject } from '../../../packages/integrations/src/storage';
const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
};
if (!process.env.DISPATCHER_DATABASE_URL) throw new Error('DISPATCHER_DATABASE_URL é obrigatória.');
const dispatcher = new Pool({ connectionString: process.env.DISPATCHER_DATABASE_URL, max: 2 });
const queue = new Queue('concloud-exports', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
});
let heartbeat = 0;
let polling = false;
async function dispatch() {
  if (polling) return;
  polling = true;
  try {
    const { rows } = await dispatcher.query<{
      id: string;
      organizationId: string;
      companyId: string;
      payload: Actor;
      resourceId: string;
    }>(
      'SELECT id,"organizationId","companyId",payload,"resourceId" FROM concloud."OutboxEvent" WHERE "completedAt" IS NULL AND ("enqueuedAt" IS NULL OR "enqueuedAt"<now()-interval \'10 minutes\') ORDER BY "createdAt" LIMIT 50',
    );
    for (const row of rows) {
      await queue.add('export', row, { jobId: row.id });
      await dispatcher.query(
        'UPDATE concloud."OutboxEvent" SET "enqueuedAt"=now(),attempts=attempts+1 WHERE id=$1',
        [row.id],
      );
    }
    heartbeat = Date.now();
  } catch {
    console.error(JSON.stringify({ event: 'outbox.dispatch.failed' }));
  } finally {
    polling = false;
  }
}
const worker = new Worker<{
  id: string;
  companyId: string;
  resourceId: string;
  payload: { actorId: string; email: string };
}>(
  'concloud-exports',
  async (job) => {
    const { companyId, resourceId, id, payload } = job.data;
    const actor = { id: payload.actorId, email: payload.email, aal: 'aal2' };
    const input = await scoped(actor, companyId, 'staff', async (tx, s) => {
      const batch = await tx.exportBatch.findFirstOrThrow({
        where: { ...tenant(s), id: resourceId },
      });
      return { batch, s };
    });
    if (input.batch.status === 'READY') {
      await scoped(actor, companyId, 'staff', async (tx, s) => {
        await tx.outboxEvent.update({
          where: { organizationId_companyId_id: { ...tenant(s), id } },
          data: { completedAt: new Date() },
        });
      });
      return;
    }
    const snapshot = input.batch.snapshot as unknown as Snapshot;
    const { bytes, manifest } = await new ManualAccountingAdapter().buildPackage(
      snapshot,
      input.batch.version,
      readObject,
    );
    const key = `${input.s.organizationId}/${companyId}/exports/${resourceId}.zip`;
    try {
      await putObject(key, bytes, 'application/zip');
    } catch {
      const existing = await readObject(key);
      const { createHash } = await import('node:crypto');
      const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
      if (digest(existing) !== digest(bytes))
        throw new Error('Pacote existente tem conteúdo divergente');
    }
    await scoped(actor, companyId, 'staff', async (tx, s) => {
      await tx.exportBatch.update({
        where: { organizationId_companyId_id: { ...tenant(s), id: resourceId } },
        data: { status: 'READY', manifest: JSON.parse(JSON.stringify(manifest)), objectKey: key },
      });
      await tx.outboxEvent.update({
        where: { organizationId_companyId_id: { ...tenant(s), id } },
        data: { completedAt: new Date(), lastError: null },
      });
      await audit(tx, actor, s, 'export.ready', resourceId);
    });
  },
  { connection, concurrency: 2 },
);
worker.on('failed', async (job) => {
  console.error(JSON.stringify({ event: 'export.failed', jobId: job?.id }));
  if (job)
    await dispatcher.query('UPDATE concloud."OutboxEvent" SET "lastError"=$2 WHERE id=$1', [
      job.id,
      'Falha na geração. Consulte logs protegidos e reexecute após correção.',
    ]);
});
const timer = setInterval(() => void dispatch(), 5000);
await dispatch();
const server = createServer(async (req, res) => {
  if (req.url !== '/health') {
    res.writeHead(404).end();
    return;
  }
  const counts = await queue.getJobCounts('failed', 'waiting', 'active');
  res
    .writeHead(Date.now() - heartbeat < 30000 ? 200 : 503, { 'Content-Type': 'application/json' })
    .end(JSON.stringify({ ok: Date.now() - heartbeat < 30000, queue: counts }));
}).listen(Number(process.env.WORKER_PORT ?? 3001), '127.0.0.1');
async function stop() {
  clearInterval(timer);
  server.close();
  await worker.close();
  await queue.close();
  await dispatcher.end();
  process.exit(0);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());

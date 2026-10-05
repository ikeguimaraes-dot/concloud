import { Queue } from 'bullmq';
const id = process.argv[2];
if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Informe o UUID do job com falha.');
const url = new URL(process.env.REDIS_URL!);
const queue = new Queue('concloud-exports', {
  connection: {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  },
});
try {
  const job = await queue.getJob(id);
  if (!job || (await job.getState()) !== 'failed')
    throw new Error('Job inexistente ou não está em falha.');
  await job.retry();
  console.log('Reexecução solicitada; os efeitos são idempotentes.');
} finally {
  await queue.close();
}

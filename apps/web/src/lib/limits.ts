import { Redis } from 'ioredis';
import { AppError } from '@domain/errors';
let client: Redis | undefined;
const localCounters = new Map<string, { count: number; expiresAt: number }>();

export function redis() {
  if (!process.env.REDIS_URL) throw new AppError('CONFIG', 'Redis não configurado.', 503);
  return (client ??= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  }));
}

function localRateLimit(key: string, limit: number) {
  const now = Date.now();
  const current = localCounters.get(key);
  const next = !current || current.expiresAt <= now
    ? { count: 1, expiresAt: now + 60_000 }
    : { ...current, count: current.count + 1 };

  localCounters.set(key, next);

  if (localCounters.size > 1_000) {
    for (const [candidate, counter] of localCounters) {
      if (counter.expiresAt <= now) localCounters.delete(candidate);
    }
  }

  if (next.count > limit)
    throw new AppError('RATE_LIMIT', 'Muitas tentativas. Aguarde um minuto.', 429);
}

export async function rateLimit(key: string, limit = 40) {
  if (!process.env.REDIS_URL) {
    localRateLimit(key, limit);
    return;
  }

  const count = await redis().eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
    1,
    `concloud:limit:${key}`,
  );
  if (Number(count) > limit)
    throw new AppError('RATE_LIMIT', 'Muitas tentativas. Aguarde um minuto.', 429);
}

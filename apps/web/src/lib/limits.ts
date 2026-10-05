import { Redis } from 'ioredis';
import { AppError } from '@domain/errors';
let client: Redis | undefined;
export function redis() {
  if (!process.env.REDIS_URL) throw new AppError('CONFIG', 'Redis não configurado.', 503);
  return (client ??= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  }));
}
export async function rateLimit(key: string, limit = 40) {
  const count = await redis().eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
    1,
    `concloud:limit:${key}`,
  );
  if (Number(count) > limit)
    throw new AppError('RATE_LIMIT', 'Muitas tentativas. Aguarde um minuto.', 429);
}

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { AppError, assert } from '../../domain/src/errors';
export const bucket = () => process.env.SUPABASE_STORAGE_BUCKET ?? 'concloud-private';
export function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AppError('CONFIG', 'Storage privado não configurado.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    .storage;
}
export function validateUpload(bytes: Uint8Array, mime: string) {
  assert(bytes.length > 0 && bytes.length <= 10 * 1024 * 1024, 'Envie um arquivo de até 10 MB.');
  const head = Buffer.from(bytes.subarray(0, 16));
  const valid =
    mime === 'application/pdf'
      ? head.toString().startsWith('%PDF-')
      : mime === 'image/png'
        ? head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === 'image/jpeg'
          ? head[0] === 255 && head[1] === 216 && head[2] === 255
          : mime === 'text/csv'
            ? !bytes.includes(0)
            : false;
  assert(valid, 'Tipo inválido. Aceitamos PDF, PNG, JPEG e CSV.');
}
export function localStorage() {
  return (
    process.env.DEMO_MODE === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    /^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL ?? '')
  );
}
function localPath(key: string) {
  assert(/^[a-zA-Z0-9/._-]+$/.test(key) && !key.includes('..'), 'Chave inválida.');
  return path.join(
    /* turbopackIgnore: true */ process.env.LOCAL_STORAGE_DIR ?? path.resolve('.local/storage'),
    key,
  );
}
export async function readObject(key: string) {
  if (localStorage()) return new Uint8Array(await readFile(localPath(key)));
  const { data, error } = await storage().from(bucket()).download(key);
  if (error || !data) throw new AppError('STORAGE', 'Documento indisponível.', 404);
  return new Uint8Array(await data.arrayBuffer());
}
export async function putObject(key: string, bytes: Uint8Array, mime: string) {
  if (localStorage()) {
    const target = localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
    return;
  }
  const { error } = await storage()
    .from(bucket())
    .upload(key, bytes, { contentType: mime, upsert: false });
  if (error) throw new AppError('STORAGE', 'Não foi possível armazenar o arquivo.', 503);
}
function signature(value: string) {
  assert(process.env.LOCAL_SIGNING_SECRET, 'Configure LOCAL_SIGNING_SECRET para a demonstração.');
  return createHmac('sha256', process.env.LOCAL_SIGNING_SECRET).update(value).digest('hex');
}
export function verifyLocalToken(token: string) {
  const [payload, sig] = token.split('.');
  assert(payload && sig && /^[a-f0-9]{64}$/.test(sig), 'Link inválido.');
  assert(
    timingSafeEqual(Buffer.from(signature(payload), 'hex'), Buffer.from(sig, 'hex')),
    'Link inválido.',
  );
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    key: string;
    expires: number;
  };
  assert(data.expires > Date.now(), 'Link expirado.');
  return data.key;
}
export async function signedDownload(key: string) {
  if (localStorage()) {
    const payload = Buffer.from(JSON.stringify({ key, expires: Date.now() + 60000 })).toString(
      'base64url',
    );
    return `/api/local-download?token=${payload}.${signature(payload)}`;
  }
  const { data, error } = await storage()
    .from(bucket())
    .createSignedUrl(key, 60, { download: true });
  if (error || !data) throw new AppError('STORAGE', 'Não foi possível gerar o download.', 503);
  return data.signedUrl;
}

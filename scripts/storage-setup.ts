import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configure Supabase URL e a credencial de servidor.');
const client = createClient(url, key, { auth: { persistSession: false } });
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'concloud-private';
if (bucket !== 'concloud-private')
  throw new Error('Este setup só administra o bucket dedicado concloud-private.');
const { data: existing, error } = await client.storage.getBucket(bucket);
if (existing) {
  if (existing.public)
    throw new Error('Bucket existente é público. Corrija a configuração antes de operar.');
  console.log('Bucket privado existente; nada alterado.');
} else {
  if (error && !/not found/i.test(error.message)) throw error;
  const { error: created } = await client.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 104857600,
    allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'text/csv', 'application/zip'],
  });
  if (created) throw created;
  console.log(
    'Bucket privado dedicado criado. Uploads da aplicação são limitados a 10 MB; pacotes a 100 MB.',
  );
}

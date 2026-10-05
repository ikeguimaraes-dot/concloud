import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const template = await readFile('.env.example', 'utf8');
await writeFile(
  '.env',
  template.replace('DEMO_MODE=false', 'DEMO_MODE=true') +
    '\nLOCAL_STORAGE_DIR=' +
    path.resolve('.local/storage') +
    '\nLOCAL_SIGNING_SECRET=' +
    randomBytes(32).toString('hex') +
    '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(
  'Ambiente local sintético configurado. Nenhuma credencial remota foi criada ou alterada.',
);

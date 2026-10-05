import EmbeddedPostgres from 'embedded-postgres';
import { mkdir } from 'node:fs/promises';
await mkdir('.local', { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: '.local/postgres',
  user: 'postgres',
  password: 'postgres',
  port: 54322,
  persistent: true,
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
await pg.initialise();
await pg.start();
console.log('PostgreSQL local em 127.0.0.1:54322. Ctrl+C para encerrar.');
async function stop() {
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

// Starts a local Postgres for development, with no Docker needed.
// Data lives in .devdb/ at the repo root; delete that folder to start clean.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_DATABASE, localPostgres, localUrl } from './local-postgres.ts';

const PORT = 54329;
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.devdb');
const fresh = !existsSync(path.join(dataDir, 'PG_VERSION'));

const db = localPostgres({ dataDir, port: PORT, persistent: true });
if (fresh) await db.initialise();
await db.start();
if (fresh) await db.createDatabase(LOCAL_DATABASE);

console.log(`Postgres ready: ${localUrl(PORT)}`);
console.log('Ctrl+C to stop.');

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void db.stop().then(() => process.exit(0));
  });
}

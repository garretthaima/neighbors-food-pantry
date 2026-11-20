import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPool, migrate } from './db.ts';
import { createLookup } from './lookup.ts';

const config = loadConfig();
if (!config.webDist) {
  const built = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (existsSync(built)) config.webDist = built;
}

const pool = createPool(config.databaseUrl);
const applied = await migrate(pool);
if (applied.length > 0) console.log(`Applied migrations: ${applied.join(', ')}`);

const app = createApp({ pool, config, lookup: createLookup(config.lookupUserAgent) });
const server = app.listen(config.port, () => {
  console.log(`Pantry inventory listening on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
}

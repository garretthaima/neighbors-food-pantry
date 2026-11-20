import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createLookup } from './modules/scan/index.ts';
import { createPool, migrate } from './shared/db.ts';
import { logger } from './shared/logger.ts';

const config = loadConfig();
if (!config.webDist) {
    const built = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
    if (existsSync(built)) config.webDist = built;
}

const pool = createPool(config.databaseUrl);
const applied = await migrate(pool);
if (applied.length > 0) logger.info({ applied }, 'Applied migrations');

const app = createApp({ pool, config, lookup: createLookup(config.lookupUserAgent) });
const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Pantry inventory listening');
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
        server.close(() => {
            void pool.end().then(() => process.exit(0));
        });
    });
}

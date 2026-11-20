// The app as the browser tests see it: a throwaway Postgres, the built web
// app, and a canned barcode lookup so no test depends on the internet.
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.ts';
import type { ProductInfo } from '../src/modules/scan/index.ts';
import { createPool, migrate } from '../src/shared/db.ts';
import { LOCAL_DATABASE, localPostgres, localUrl } from './local-postgres.ts';

const PORT = Number(process.env.PORT ?? 4100);
const DB_PORT = PORT + 1;

export const E2E_PIN = '2468';

const KNOWN: Record<string, ProductInfo> = {
    '0024000163022': {
        name: 'Whole Kernel Corn',
        brand: 'Del Monte',
        size: '15.25 oz',
        category: 'Canned sweet corn',
        imageUrl: '',
        source: 'openfoodfacts',
    },
    '0051000012517': {
        name: 'Chicken Noodle Soup',
        brand: "Campbell's",
        size: '10.75 oz',
        category: 'Soups',
        imageUrl: '',
        source: 'openfoodfacts',
    },
};

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'pantry-e2e-'));
const postgres = localPostgres({ dataDir, port: DB_PORT, persistent: false });
await postgres.initialise();
await postgres.start();
await postgres.createDatabase(LOCAL_DATABASE);

const pool = createPool(localUrl(DB_PORT));
await migrate(pool);

const app = createApp({
    pool,
    config: {
        port: PORT,
        databaseUrl: localUrl(DB_PORT),
        editPin: E2E_PIN,
        viewPin: '',
        sessionSecret: 'e2e-only',
        lookupUserAgent: 'e2e',
        webDist: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist'),
    },
    lookup: async (barcode) => KNOWN[barcode] ?? null,
});
const server = app.listen(PORT, () => console.log(`E2E server on :${PORT}`));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
        server.close();
        void pool
            .end()
            .then(() => postgres.stop())
            .then(() => process.exit(0));
    });
}

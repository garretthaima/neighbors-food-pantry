import { randomBytes } from 'node:crypto';
import type { Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { localUrl } from '../../scripts/local-postgres.ts';
import { createApp } from '../../src/app.ts';
import type { Config } from '../../src/config.ts';
import type { ProductInfo } from '../../src/modules/scan/index.ts';
import { createPool, migrate } from '../../src/shared/db.ts';

export const PIN = '2468';
export const CORN = '024000163022'; // UPC-A as a scanner sends it
export const CORN_STORED = '0024000163022';

export const cornInfo: ProductInfo = {
    name: 'Whole Kernel Corn',
    brand: 'Del Monte',
    size: '14.5 oz',
    category: 'Canned sweet corn',
    imageUrl: '',
    source: 'openfoodfacts',
};

/** A new, empty database of this file's own. The caller ends the pool. */
export async function createTestDatabase(): Promise<pg.Pool> {
    const port = inject('pgPort');
    const name = `t_${randomBytes(6).toString('hex')}`;
    const admin = new pg.Client({ connectionString: localUrl(port) });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name}`);
    await admin.end();
    return createPool(localUrl(port, name));
}

/**
 * Call once at the top of a test file. Gives the file a migrated database
 * that is emptied before each test, and an app wired to a fake lookup.
 */
export function useTestApp() {
    const t = {
        pool: undefined as unknown as pg.Pool,
        /** Barcodes the fake lookup knows. Reset before each test. */
        known: {} as Record<string, ProductInfo>,
        /** Barcodes the app asked the lookup about. Reset before each test. */
        lookups: [] as string[],

        app(overrides: Partial<Config> = {}): Express {
            const config: Config = {
                port: 0,
                databaseUrl: '',
                editPin: PIN,
                viewPin: '',
                sessionSecret: 'test-secret',
                lookupUserAgent: 'test',
                webDist: null,
                ...overrides,
            };
            return createApp({
                pool: t.pool,
                config,
                lookup: async (barcode) => {
                    t.lookups.push(barcode);
                    return t.known[barcode] ?? null;
                },
            });
        },

        /** A signed-in volunteer for the given app (a default app if omitted). */
        async editor(app: Express = t.app()) {
            const agent = request.agent(app);
            await agent.post('/api/login').send({ pin: PIN }).expect(200);
            return agent;
        },
    };

    beforeAll(async () => {
        t.pool = await createTestDatabase();
        await migrate(t.pool);
    });

    afterAll(async () => {
        await t.pool?.end();
    });

    beforeEach(async () => {
        await t.pool.query('TRUNCATE stock_events, products, shelves RESTART IDENTITY CASCADE');
        t.known = { [CORN_STORED]: cornInfo };
        t.lookups = [];
    });

    return t;
}

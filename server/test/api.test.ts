import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type EmbeddedPostgres from 'embedded-postgres';
import type { Express } from 'express';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { normalizeBarcode } from '../src/barcode.ts';
import type { Config } from '../src/config.ts';
import { createPool, migrate } from '../src/db.ts';
import { createLookup } from '../src/lookup.ts';
import type { ProductInfo } from '../src/lookup.ts';
import { LOCAL_DATABASE, localPostgres, localUrl } from '../scripts/local-postgres.ts';

const PORT = 54400 + Math.floor(Math.random() * 500);
const CORN = '024000163022'; // UPC-A as a scanner sends it
const CORN_STORED = '0024000163022';

const cornInfo: ProductInfo = {
  name: 'Whole Kernel Corn',
  brand: 'Del Monte',
  size: '14.5 oz',
  category: 'Canned sweet corn',
  imageUrl: '',
  source: 'openfoodfacts',
};

let dataDir: string;
let postgres: EmbeddedPostgres;
let pool: pg.Pool;
let known: Record<string, ProductInfo>;
let lookups: string[];

function makeApp(overrides: Partial<Config> = {}): Express {
  const config: Config = {
    port: 0,
    databaseUrl: '',
    editPin: '2468',
    viewPin: '',
    sessionSecret: 'test-secret',
    lookupUserAgent: 'test',
    webDist: null,
    ...overrides,
  };
  return createApp({
    pool,
    config,
    lookup: async (barcode) => {
      lookups.push(barcode);
      return known[barcode] ?? null;
    },
  });
}

async function editor(app: Express) {
  const agent = request.agent(app);
  await agent.post('/api/login').send({ pin: '2468' }).expect(200);
  return agent;
}

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'pantry-test-'));
  postgres = localPostgres({ dataDir, port: PORT, persistent: false });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(LOCAL_DATABASE);
  pool = createPool(localUrl(PORT));
  expect(await migrate(pool)).toEqual(['001_init.sql']);
});

afterAll(async () => {
  await pool?.end();
  await postgres?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await pool.query('TRUNCATE stock_events, products, shelves RESTART IDENTITY CASCADE');
  known = { [CORN_STORED]: cornInfo };
  lookups = [];
});

describe('normalizeBarcode', () => {
  it('pads UPC-A to 13 digits and keeps EAN-13 as is', () => {
    expect(normalizeBarcode('024000163022')).toBe('0024000163022');
    expect(normalizeBarcode('3017620422003')).toBe('3017620422003');
    expect(normalizeBarcode(' 0240-0016 3022 ')).toBe('0024000163022');
  });

  it('rejects things that are not retail barcodes', () => {
    for (const bad of ['', 'abc', '12345', 'https://example.com', null, undefined, {}]) {
      expect(normalizeBarcode(bad)).toBeNull();
    }
  });
});

describe('migrations', () => {
  it('does nothing on a second run', async () => {
    expect(await migrate(pool)).toEqual([]);
  });
});

describe('access', () => {
  it('lets anyone view but only the volunteer PIN change things', async () => {
    const app = makeApp();
    await request(app).get('/api/products').expect(200, []);
    await request(app).post('/api/scan').send({ barcode: CORN, mode: 'in' }).expect(403);
    await request(app).post('/api/login').send({ pin: 'nope' }).expect(401);
    const me = await (await editor(app)).get('/api/me').expect(200);
    expect(me.body).toEqual({ role: 'editor', viewNeedsPin: false });
  });

  it('hides the inventory behind the view PIN when one is set', async () => {
    const app = makeApp({ viewPin: '1111' });
    await request(app).get('/api/products').expect(401);
    const viewer = request.agent(app);
    await viewer.post('/api/login').send({ pin: '1111' }).expect(200, { role: 'viewer' });
    await viewer.get('/api/products').expect(200);
    await viewer.post('/api/shelves').send({ name: 'A' }).expect(403);
  });

  it('rejects a cookie signed with a different secret', async () => {
    const agent = await editor(makeApp({ sessionSecret: 'other-secret' }));
    const cookie = (await agent.post('/api/login').send({ pin: '2468' })).headers['set-cookie']![0]!.split(';')[0]!;
    await request(makeApp()).post('/api/shelves').set('Cookie', cookie).send({ name: 'A' }).expect(403);
  });

  it('locks out after repeated wrong PINs', async () => {
    const app = makeApp();
    for (let i = 0; i < 10; i++) await request(app).post('/api/login').send({ pin: 'x' }).expect(401);
    await request(app).post('/api/login').send({ pin: '2468' }).expect(429);
  });
});

describe('scanning', () => {
  it('looks a new barcode up once, then counts later scans from the database', async () => {
    const agent = await editor(makeApp());

    const first = await agent.post('/api/scan').send({ barcode: CORN, mode: 'in' }).expect(200);
    expect(first.body).toMatchObject({
      status: 'ok',
      created: true,
      product: { barcode: CORN_STORED, name: 'Whole Kernel Corn', brand: 'Del Monte', quantity: 1, shelfId: null },
    });

    // Same can scanned as EAN-13 by a different scanner.
    const second = await agent.post('/api/scan').send({ barcode: CORN_STORED, mode: 'in' }).expect(200);
    expect(second.body).toMatchObject({ created: false, product: { quantity: 2 } });
    expect(lookups).toEqual([CORN_STORED]);
  });

  it('puts scanned items on the chosen shelf', async () => {
    const agent = await editor(makeApp());
    const shelf = (await agent.post('/api/shelves').send({ name: 'A1' }).expect(201)).body;
    const res = await agent.post('/api/scan').send({ barcode: CORN, mode: 'in', shelfId: shelf.id }).expect(200);
    expect(res.body.product).toMatchObject({ shelfId: shelf.id, shelfName: 'A1' });

    const shelves = (await agent.get('/api/shelves').expect(200)).body;
    expect(shelves).toMatchObject([{ name: 'A1', productCount: 1, itemCount: 1 }]);
  });

  it('gives items out and refuses to go below zero', async () => {
    const agent = await editor(makeApp());
    await agent.post('/api/scan').send({ barcode: CORN, mode: 'in' }).expect(200);
    const out = await agent.post('/api/scan').send({ barcode: CORN, mode: 'out' }).expect(200);
    expect(out.body.product.quantity).toBe(0);
    const again = await agent.post('/api/scan').send({ barcode: CORN, mode: 'out' }).expect(409);
    expect(again.body.error).toMatch(/none of these left/);
  });

  it('reports an unknown barcode without creating anything', async () => {
    const agent = await editor(makeApp());
    const res = await agent.post('/api/scan').send({ barcode: '036000291452', mode: 'in' }).expect(200);
    expect(res.body).toEqual({ status: 'unknown', barcode: '0036000291452' });
    await agent.get('/api/products').expect(200, []);

    // Giving out something never recorded does not call the lookup services.
    lookups = [];
    await agent.post('/api/scan').send({ barcode: CORN, mode: 'out' }).expect(200, { status: 'unknown', barcode: CORN_STORED });
    expect(lookups).toEqual([]);
  });

  it('rejects input that is not a barcode', async () => {
    const agent = await editor(makeApp());
    await agent.post('/api/scan').send({ barcode: 'hello', mode: 'in' }).expect(400);
  });
});

describe('products', () => {
  it('adds an item by hand, edits it and records each quantity change', async () => {
    const agent = await editor(makeApp());
    const created = (
      await agent.post('/api/products').send({ name: 'Home-canned peaches', quantity: 3, barcode: '' }).expect(201)
    ).body;
    expect(created).toMatchObject({ name: 'Home-canned peaches', barcode: null, quantity: 3, source: 'manual' });

    const edited = (await agent.patch(`/api/products/${created.id}`).send({ size: '1 quart', quantity: 5 }).expect(200)).body;
    expect(edited).toMatchObject({ size: '1 quart', quantity: 5, name: 'Home-canned peaches' });

    await agent.post(`/api/products/${created.id}/stock`).send({ delta: -2 }).expect(200);
    await agent.post(`/api/products/${created.id}/stock`).send({ delta: -9 }).expect(409);

    const activity = (await agent.get('/api/activity').expect(200)).body;
    expect(activity.last30Days).toEqual({ received: 3, givenOut: 2 });
    expect(activity.events.map((e: { delta: number; reason: string }) => [e.delta, e.reason])).toEqual([
      [-2, 'out'],
      [2, 'adjust'],
      [3, 'in'],
    ]);
  });

  it('refuses a duplicate barcode and bad input with a readable message', async () => {
    const agent = await editor(makeApp());
    await agent.post('/api/products').send({ name: 'Beans', barcode: CORN }).expect(201);
    const dup = await agent.post('/api/products').send({ name: 'Other beans', barcode: CORN_STORED }).expect(409);
    expect(dup.body.error).toBe('Another item already has that barcode.');
    await agent.post('/api/products').send({ name: '  ' }).expect(400);
    await agent.post('/api/products').send({ name: 'x', quantity: -1 }).expect(400);
    await agent.post('/api/products').send({ name: 'x', shelfId: 999 }).expect(400);
    await agent.patch('/api/products/999').send({ name: 'x' }).expect(404);
  });

  it('keeps products when their shelf is deleted', async () => {
    const agent = await editor(makeApp());
    const shelf = (await agent.post('/api/shelves').send({ name: 'Top' }).expect(201)).body;
    await agent.post('/api/shelves').send({ name: 'top' }).expect(409);
    const product = (await agent.post('/api/products').send({ name: 'Rice', shelfId: shelf.id }).expect(201)).body;
    await agent.delete(`/api/shelves/${shelf.id}`).expect(204);
    const after = (await agent.get('/api/products').expect(200)).body;
    expect(after).toMatchObject([{ id: product.id, shelfId: null, shelfName: null }]);
    await agent.delete(`/api/products/${product.id}`).expect(204);
    await agent.get('/api/products').expect(200, []);
  });
});

describe('lookup services', () => {
  function fakeFetch(responses: Record<string, unknown>) {
    const calls: string[] = [];
    const fn = (async (url: string | URL | Request) => {
      const href = String(url);
      calls.push(href);
      const host = new URL(href).host;
      return new Response(JSON.stringify(responses[host] ?? {}), { status: host in responses ? 200 : 404 });
    }) as typeof fetch;
    return { fn, calls };
  }

  it('reads an Open Food Facts product', async () => {
    const { fn, calls } = fakeFetch({
      'world.openfoodfacts.org': {
        status: 1,
        product: {
          product_name: ' Whole Kernel Corn ',
          brands: 'Del Monte,Del Monte Foods',
          quantity: '14.5 oz',
          categories_tags: ['en:plant-based-foods', 'en:canned-sweet-corn', 'fr:haricots'],
          image_front_small_url: 'https://images.example/corn.jpg',
        },
      },
    });
    expect(await createLookup('ua', fn)(CORN_STORED)).toEqual({
      name: 'Whole Kernel Corn',
      brand: 'Del Monte',
      size: '14.5 oz',
      category: 'Canned sweet corn',
      imageUrl: 'https://images.example/corn.jpg',
      source: 'openfoodfacts',
    });
    expect(calls).toHaveLength(1);
  });

  it('falls back to UPCitemdb with the 12-digit code, and to null when both miss', async () => {
    const { fn, calls } = fakeFetch({
      'world.openfoodfacts.org': { status: 0 },
      'api.upcitemdb.com': {
        code: 'OK',
        items: [{ title: "DOVE BAR SOAP (4-PACK)", brand: 'Dove', category: 'Health & Beauty > Bath & Body > Bar Soap', images: [] }],
      },
    });
    expect(await createLookup('ua', fn)(CORN_STORED)).toMatchObject({
      name: 'Dove Bar Soap (4-Pack)',
      category: 'Bar Soap',
      source: 'upcitemdb',
    });
    expect(calls[1]).toContain(`upc=${CORN}`);

    expect(await createLookup('ua', fakeFetch({}).fn)(CORN_STORED)).toBeNull();
  });
});

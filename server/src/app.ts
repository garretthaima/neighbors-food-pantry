import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type pg from 'pg';
import { createAuth } from './auth.ts';
import { normalizeBarcode } from './barcode.ts';
import type { Config } from './config.ts';
import { withTransaction } from './db.ts';
import type { Lookup } from './lookup.ts';

type Queryable = pg.Pool | pg.PoolClient;

/** An error whose message is safe and useful to show the person using the app. */
class UserError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PRODUCT_COLUMNS = `
  p.id, p.barcode, p.name, p.brand, p.size, p.category,
  p.image_url AS "imageUrl", p.source, p.quantity,
  p.shelf_id AS "shelfId", s.name AS "shelfName",
  p.updated_at AS "updatedAt"`;

const PRODUCT_FROM = 'FROM products p LEFT JOIN shelves s ON s.id = p.shelf_id';

async function getProduct(db: Queryable, id: number) {
  const { rows } = await db.query(`SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM} WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new UserError(404, 'Not found.');
  return id;
}

function optionalText(value: unknown, field: string, max = 200): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new UserError(400, `${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new UserError(400, `${field} is too long.`);
  return trimmed;
}

function requiredText(value: unknown, field: string, max = 200): string {
  const result = optionalText(value, field, max);
  if (!result) throw new UserError(400, `${field} is required.`);
  return result;
}

/** undefined = not sent, null = clear the shelf, number = that shelf. */
function optionalShelfId(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new UserError(400, 'Shelf is not valid.');
  }
  return value;
}

function optionalBarcode(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const barcode = normalizeBarcode(value);
  if (!barcode) throw new UserError(400, 'Barcodes are 8, 12, 13 or 14 digits.');
  return barcode;
}

function wholeNumber(value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || Math.abs(value) > 100_000) {
    throw new UserError(400, `${field} must be a whole number.`);
  }
  return value;
}

export interface AppDeps {
  pool: pg.Pool;
  config: Config;
  lookup: Lookup;
}

export function createApp({ pool, config, lookup }: AppDeps): express.Express {
  const app = express();
  const auth = createAuth(config);

  // One proxy hop (the cluster gateway) sits in front, so req.ip and
  // req.secure come from its X-Forwarded-* headers.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));

  const api = express.Router();
  app.use('/api', api);

  api.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });

  api.get('/me', (req, res) => {
    res.json({ role: auth.roleOf(req), viewNeedsPin: Boolean(config.viewPin) });
  });
  api.post('/login', auth.login);
  api.post('/logout', auth.logout);

  // ---- Products -----------------------------------------------------------

  api.get('/products', auth.requireView, async (_req, res) => {
    const { rows } = await pool.query(`SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM} ORDER BY lower(p.name), p.id`);
    res.json(rows);
  });

  api.post('/products', auth.requireEdit, async (req, res) => {
    const body = req.body ?? {};
    const name = requiredText(body.name, 'Name');
    const brand = optionalText(body.brand, 'Brand') ?? '';
    const size = optionalText(body.size, 'Size') ?? '';
    const category = optionalText(body.category, 'Category') ?? '';
    const barcode = optionalBarcode(body.barcode) ?? null;
    const shelfId = optionalShelfId(body.shelfId) ?? null;
    const quantity = body.quantity === undefined ? 0 : wholeNumber(body.quantity, 'Quantity', 0);

    const product = await withTransaction(pool, async (db) => {
      const { rows } = await db.query<{ id: number }>(
        `INSERT INTO products (barcode, name, brand, size, category, shelf_id, quantity, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual') RETURNING id`,
        [barcode, name, brand, size, category, shelfId, quantity],
      );
      const id = rows[0]!.id;
      if (quantity > 0) {
        await db.query(`INSERT INTO stock_events (product_id, delta, reason) VALUES ($1, $2, 'in')`, [id, quantity]);
      }
      return getProduct(db, id);
    });
    res.status(201).json(product);
  });

  api.patch('/products/:id', auth.requireEdit, async (req, res) => {
    const id = idParam(req);
    const body = req.body ?? {};
    const fields: Record<string, unknown> = {
      name: body.name === undefined ? undefined : requiredText(body.name, 'Name'),
      brand: optionalText(body.brand, 'Brand'),
      size: optionalText(body.size, 'Size'),
      category: optionalText(body.category, 'Category'),
      barcode: optionalBarcode(body.barcode),
      shelf_id: optionalShelfId(body.shelfId),
    };
    const quantity = body.quantity === undefined ? undefined : wholeNumber(body.quantity, 'Quantity', 0);

    const product = await withTransaction(pool, async (db) => {
      const current = await db.query<{ quantity: number }>('SELECT quantity FROM products WHERE id = $1 FOR UPDATE', [id]);
      if (current.rowCount === 0) throw new UserError(404, 'That item is no longer in the inventory.');

      const sets: string[] = ['updated_at = now()'];
      const values: unknown[] = [id];
      for (const [column, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      }
      if (quantity !== undefined) {
        values.push(quantity);
        sets.push(`quantity = $${values.length}`);
        const delta = quantity - current.rows[0]!.quantity;
        if (delta !== 0) {
          await db.query(`INSERT INTO stock_events (product_id, delta, reason) VALUES ($1, $2, 'adjust')`, [id, delta]);
        }
      }
      await db.query(`UPDATE products SET ${sets.join(', ')} WHERE id = $1`, values);
      return getProduct(db, id);
    });
    res.json(product);
  });

  api.delete('/products/:id', auth.requireEdit, async (req, res) => {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [idParam(req)]);
    if (result.rowCount === 0) throw new UserError(404, 'That item is no longer in the inventory.');
    res.status(204).end();
  });

  /** Adds or removes stock for one product. Shared by scan and the +/- buttons. */
  async function changeStock(db: Queryable, id: number, delta: number, reason: 'in' | 'out' | 'adjust') {
    const result = await db.query(
      `UPDATE products SET quantity = quantity + $2, updated_at = now()
       WHERE id = $1 AND quantity + $2 >= 0`,
      [id, delta],
    );
    if (result.rowCount === 0) {
      const exists = await db.query('SELECT 1 FROM products WHERE id = $1', [id]);
      if (exists.rowCount === 0) throw new UserError(404, 'That item is no longer in the inventory.');
      throw new UserError(409, 'The inventory shows none of these left to give out.');
    }
    await db.query('INSERT INTO stock_events (product_id, delta, reason) VALUES ($1, $2, $3)', [id, delta, reason]);
  }

  api.post('/products/:id/stock', auth.requireEdit, async (req, res) => {
    const id = idParam(req);
    const delta = wholeNumber(req.body?.delta, 'Change', -100_000);
    if (delta === 0) throw new UserError(400, 'Change cannot be zero.');
    const reason = req.body?.reason === 'adjust' ? 'adjust' : delta > 0 ? 'in' : 'out';
    const product = await withTransaction(pool, async (db) => {
      await changeStock(db, id, delta, reason);
      return getProduct(db, id);
    });
    res.json(product);
  });

  // ---- Scanning -----------------------------------------------------------

  api.post('/scan', auth.requireEdit, async (req, res) => {
    const body = req.body ?? {};
    const barcode = normalizeBarcode(body.barcode);
    if (!barcode) throw new UserError(400, 'That does not look like a product barcode. Scan it again.');
    const mode = body.mode === 'out' ? 'out' : 'in';
    const shelfId = optionalShelfId(body.shelfId);

    const existing = await pool.query<{ id: number }>('SELECT id FROM products WHERE barcode = $1', [barcode]);
    let id = existing.rows[0]?.id;
    let created = false;

    if (id === undefined) {
      if (mode === 'out') {
        res.json({ status: 'unknown', barcode });
        return;
      }
      const info = await lookup(barcode);
      if (!info) {
        res.json({ status: 'unknown', barcode });
        return;
      }
      // ON CONFLICT covers two volunteers scanning the same new item at once.
      const inserted = await pool.query<{ id: number; inserted: boolean }>(
        `INSERT INTO products (barcode, name, brand, size, category, image_url, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (barcode) DO UPDATE SET barcode = EXCLUDED.barcode
         RETURNING id, (xmax = 0) AS inserted`,
        [barcode, info.name.slice(0, 200), info.brand.slice(0, 200), info.size.slice(0, 200), info.category.slice(0, 200), info.imageUrl, info.source],
      );
      id = inserted.rows[0]!.id;
      created = inserted.rows[0]!.inserted;
    }

    const productId = id;
    const product = await withTransaction(pool, async (db) => {
      await changeStock(db, productId, mode === 'in' ? 1 : -1, mode);
      if (mode === 'in' && typeof shelfId === 'number') {
        await db.query('UPDATE products SET shelf_id = $2 WHERE id = $1', [productId, shelfId]);
      }
      return getProduct(db, productId);
    });
    res.json({ status: 'ok', created, product });
  });

  // ---- Shelves ------------------------------------------------------------

  api.get('/shelves', auth.requireView, async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT s.id, s.name, s.notes,
             count(p.id)::int AS "productCount",
             coalesce(sum(p.quantity), 0)::int AS "itemCount"
      FROM shelves s LEFT JOIN products p ON p.shelf_id = s.id
      GROUP BY s.id ORDER BY lower(s.name)`);
    res.json(rows);
  });

  api.post('/shelves', auth.requireEdit, async (req, res) => {
    const name = requiredText(req.body?.name, 'Shelf name', 60);
    const notes = optionalText(req.body?.notes, 'Notes', 300) ?? '';
    const { rows } = await pool.query(
      `INSERT INTO shelves (name, notes) VALUES ($1, $2)
       RETURNING id, name, notes, 0 AS "productCount", 0 AS "itemCount"`,
      [name, notes],
    );
    res.status(201).json(rows[0]);
  });

  api.patch('/shelves/:id', auth.requireEdit, async (req, res) => {
    const name = req.body?.name === undefined ? undefined : requiredText(req.body.name, 'Shelf name', 60);
    const notes = optionalText(req.body?.notes, 'Notes', 300);
    const { rows } = await pool.query(
      `UPDATE shelves SET name = coalesce($2, name), notes = coalesce($3, notes)
       WHERE id = $1 RETURNING id, name, notes`,
      [idParam(req), name ?? null, notes ?? null],
    );
    if (rows.length === 0) throw new UserError(404, 'That shelf no longer exists.');
    res.json(rows[0]);
  });

  api.delete('/shelves/:id', auth.requireEdit, async (req, res) => {
    // Products on the shelf are kept and become "not on a shelf yet".
    const result = await pool.query('DELETE FROM shelves WHERE id = $1', [idParam(req)]);
    if (result.rowCount === 0) throw new UserError(404, 'That shelf no longer exists.');
    res.status(204).end();
  });

  // ---- Activity -----------------------------------------------------------

  api.get('/activity', auth.requireView, async (_req, res) => {
    const [events, totals] = await Promise.all([
      pool.query(`
        SELECT e.id, e.delta, e.reason, e.created_at AS "createdAt",
               p.id AS "productId", p.name AS "productName"
        FROM stock_events e JOIN products p ON p.id = e.product_id
        ORDER BY e.created_at DESC, e.id DESC LIMIT 100`),
      pool.query(`
        SELECT coalesce(sum(delta) FILTER (WHERE reason = 'in'), 0)::int AS "received",
               coalesce(-sum(delta) FILTER (WHERE reason = 'out'), 0)::int AS "givenOut"
        FROM stock_events WHERE created_at >= now() - interval '30 days'`),
    ]);
    res.json({ last30Days: totals.rows[0], events: events.rows });
  });

  api.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // ---- Web app ------------------------------------------------------------

  if (config.webDist) {
    const dist = path.resolve(config.webDist);
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof UserError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    const pgCode = (err as { code?: string }).code;
    if (pgCode === '23505') {
      const onShelf = (err as { constraint?: string }).constraint === 'shelves_name_key';
      res.status(409).json({
        error: onShelf ? 'A shelf with that name already exists.' : 'Another item already has that barcode.',
      });
      return;
    }
    if (pgCode === '23503') {
      res.status(400).json({ error: 'That shelf no longer exists.' });
      return;
    }
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 413) {
      res.status(status).json({ error: 'The request could not be read.' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
  });

  return app;
}

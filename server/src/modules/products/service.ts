import type pg from 'pg';
import { withTransaction } from '../../shared/db.ts';
import type { Queryable } from '../../shared/db.ts';
import { conflict, notFound } from '../../shared/errors.ts';

export type StockReason = 'in' | 'out' | 'adjust';

export interface NewProduct {
    name: string;
    brand: string;
    size: string;
    category: string;
    barcode: string | null;
    shelfId: number | null;
    quantity: number;
}

/** Only the fields that were sent. Keys are column names. */
export interface ProductChanges {
    columns: Record<string, unknown>;
    quantity: number | undefined;
}

/** What a barcode lookup knows about a product seen for the first time. */
export interface LookedUpProduct {
    barcode: string;
    name: string;
    brand: string;
    size: string;
    category: string;
    imageUrl: string;
    source: string;
}

const GONE = 'That item is no longer in the inventory.';

const COLUMNS = `
  p.id, p.barcode, p.name, p.brand, p.size, p.category,
  p.image_url AS "imageUrl", p.source, p.quantity,
  p.shelf_id AS "shelfId", s.name AS "shelfName",
  p.updated_at AS "updatedAt"`;

const FROM = 'FROM products p LEFT JOIN shelves s ON s.id = p.shelf_id';

export async function listProducts(db: Queryable) {
    const { rows } = await db.query(`SELECT ${COLUMNS} ${FROM} ORDER BY lower(p.name), p.id`);
    return rows;
}

export async function getProduct(db: Queryable, id: number) {
    const { rows } = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE p.id = $1`, [id]);
    return rows[0] ?? null;
}

export async function findIdByBarcode(db: Queryable, barcode: string): Promise<number | undefined> {
    const { rows } = await db.query<{ id: number }>('SELECT id FROM products WHERE barcode = $1', [
        barcode,
    ]);
    return rows[0]?.id;
}

export async function createProduct(pool: pg.Pool, input: NewProduct) {
    return withTransaction(pool, async (db) => {
        const { rows } = await db.query<{ id: number }>(
            `INSERT INTO products (barcode, name, brand, size, category, shelf_id, quantity, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual') RETURNING id`,
            [
                input.barcode,
                input.name,
                input.brand,
                input.size,
                input.category,
                input.shelfId,
                input.quantity,
            ]
        );
        const id = rows[0]!.id;
        if (input.quantity > 0) await recordEvent(db, id, input.quantity, 'in');
        return getProduct(db, id);
    });
}

/**
 * Saves a product the lookup services just described, with no stock yet.
 * Returns whether this call created it: two volunteers can scan the same new
 * item at once, and ON CONFLICT lets the second one find the first's row.
 */
export async function createFromLookup(db: Queryable, info: LookedUpProduct) {
    const text = (value: string) => value.slice(0, 200);
    const { rows } = await db.query<{ id: number; inserted: boolean }>(
        `INSERT INTO products (barcode, name, brand, size, category, image_url, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (barcode) DO UPDATE SET barcode = EXCLUDED.barcode
     RETURNING id, (xmax = 0) AS inserted`,
        [
            info.barcode,
            text(info.name),
            text(info.brand),
            text(info.size),
            text(info.category),
            info.imageUrl,
            info.source,
        ]
    );
    return { id: rows[0]!.id, created: rows[0]!.inserted };
}

export async function updateProduct(pool: pg.Pool, id: number, changes: ProductChanges) {
    return withTransaction(pool, async (db) => {
        const current = await db.query<{ quantity: number }>(
            'SELECT quantity FROM products WHERE id = $1 FOR UPDATE',
            [id]
        );
        if (current.rowCount === 0) throw notFound(GONE);

        const sets: string[] = ['updated_at = now()'];
        const values: unknown[] = [id];
        const set = (column: string, value: unknown) => {
            values.push(value);
            sets.push(`${column} = $${values.length}`);
        };
        for (const [column, value] of Object.entries(changes.columns)) {
            if (value !== undefined) set(column, value);
        }
        if (changes.quantity !== undefined) {
            set('quantity', changes.quantity);
            const delta = changes.quantity - current.rows[0]!.quantity;
            if (delta !== 0) await recordEvent(db, id, delta, 'adjust');
        }
        await db.query(`UPDATE products SET ${sets.join(', ')} WHERE id = $1`, values);
        return getProduct(db, id);
    });
}

export async function deleteProduct(db: Queryable, id: number): Promise<void> {
    const result = await db.query('DELETE FROM products WHERE id = $1', [id]);
    if (result.rowCount === 0) throw notFound(GONE);
}

export async function setShelf(db: Queryable, id: number, shelfId: number): Promise<void> {
    await db.query('UPDATE products SET shelf_id = $2 WHERE id = $1', [id, shelfId]);
}

/** Adds or removes stock for one product. Never lets the count go below zero. */
export async function changeStock(
    db: Queryable,
    id: number,
    delta: number,
    reason: StockReason
): Promise<void> {
    const result = await db.query(
        `UPDATE products SET quantity = quantity + $2, updated_at = now()
     WHERE id = $1 AND quantity + $2 >= 0`,
        [id, delta]
    );
    if (result.rowCount === 0) {
        const exists = await db.query('SELECT 1 FROM products WHERE id = $1', [id]);
        if (exists.rowCount === 0) throw notFound(GONE);
        throw conflict('The inventory shows none of these left to give out.');
    }
    await recordEvent(db, id, delta, reason);
}

/** changeStock in its own transaction, returning the product afterwards. */
export async function adjustStock(pool: pg.Pool, id: number, delta: number, reason: StockReason) {
    return withTransaction(pool, async (db) => {
        await changeStock(db, id, delta, reason);
        return getProduct(db, id);
    });
}

async function recordEvent(
    db: Queryable,
    id: number,
    delta: number,
    reason: StockReason
): Promise<void> {
    await db.query('INSERT INTO stock_events (product_id, delta, reason) VALUES ($1, $2, $3)', [
        id,
        delta,
        reason,
    ]);
}

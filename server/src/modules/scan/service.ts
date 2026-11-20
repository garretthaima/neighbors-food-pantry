import type pg from 'pg';
import { withTransaction } from '../../shared/db.ts';
import {
    changeStock,
    createFromLookup,
    findIdByBarcode,
    getProduct,
    setShelf,
} from '../products/index.ts';
import type { Lookup } from './lookup.ts';

export interface ScanInput {
    barcode: string;
    mode: 'in' | 'out';
    /** The shelf to put received items on, when the volunteer picked one. */
    shelfId: number | null | undefined;
}

export type ScanResult =
    { status: 'ok'; created: boolean; product: unknown } | { status: 'unknown'; barcode: string };

/**
 * Counts one scanned item in or out. A barcode seen for the first time is
 * looked up once and saved; later scans never leave the database.
 */
export async function scan(
    deps: { pool: pg.Pool; lookup: Lookup },
    input: ScanInput
): Promise<ScanResult> {
    const { pool, lookup } = deps;
    const { barcode, mode, shelfId } = input;

    let id = await findIdByBarcode(pool, barcode);
    let created = false;

    if (id === undefined) {
        // Giving out something never recorded: nothing to count down.
        if (mode === 'out') return { status: 'unknown', barcode };
        const info = await lookup(barcode);
        if (!info) return { status: 'unknown', barcode };
        ({ id, created } = await createFromLookup(pool, { barcode, ...info }));
    }

    const productId = id;
    const product = await withTransaction(pool, async (db) => {
        await changeStock(db, productId, mode === 'in' ? 1 : -1, mode);
        if (mode === 'in' && typeof shelfId === 'number') await setShelf(db, productId, shelfId);
        return getProduct(db, productId);
    });
    return { status: 'ok', created, product };
}

import type { Queryable } from '../../shared/db.ts';
import { notFound } from '../../shared/errors.ts';

const GONE = 'That shelf no longer exists.';

export async function listShelves(db: Queryable) {
    const { rows } = await db.query(`
    SELECT s.id, s.name, s.notes,
           count(p.id)::int AS "productCount",
           coalesce(sum(p.quantity), 0)::int AS "itemCount"
    FROM shelves s LEFT JOIN products p ON p.shelf_id = s.id
    GROUP BY s.id ORDER BY lower(s.name)`);
    return rows;
}

export async function createShelf(db: Queryable, input: { name: string; notes: string }) {
    const { rows } = await db.query(
        `INSERT INTO shelves (name, notes) VALUES ($1, $2)
     RETURNING id, name, notes, 0 AS "productCount", 0 AS "itemCount"`,
        [input.name, input.notes]
    );
    return rows[0];
}

/** Changes only the fields that were sent. */
export async function updateShelf(
    db: Queryable,
    id: number,
    changes: { name?: string; notes?: string }
) {
    const { rows } = await db.query(
        `UPDATE shelves SET name = coalesce($2, name), notes = coalesce($3, notes)
     WHERE id = $1 RETURNING id, name, notes`,
        [id, changes.name ?? null, changes.notes ?? null]
    );
    if (rows.length === 0) throw notFound(GONE);
    return rows[0];
}

/** Products on the shelf are kept and become "not on a shelf yet". */
export async function deleteShelf(db: Queryable, id: number): Promise<void> {
    const result = await db.query('DELETE FROM shelves WHERE id = $1', [id]);
    if (result.rowCount === 0) throw notFound(GONE);
}

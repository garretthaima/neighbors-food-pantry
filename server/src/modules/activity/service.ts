import type { Queryable } from '../../shared/db.ts';

/** The latest stock changes and the totals for the last 30 days. */
export async function recentActivity(db: Queryable) {
    const events = await db.query(`
    SELECT e.id, e.delta, e.reason, e.created_at AS "createdAt",
           p.id AS "productId", p.name AS "productName"
    FROM stock_events e JOIN products p ON p.id = e.product_id
    ORDER BY e.created_at DESC, e.id DESC LIMIT 100`);
    const totals = await db.query(`
    SELECT coalesce(sum(delta) FILTER (WHERE reason = 'in'), 0)::int AS "received",
           coalesce(-sum(delta) FILTER (WHERE reason = 'out'), 0)::int AS "givenOut"
    FROM stock_events WHERE created_at >= now() - interval '30 days'`);
    return { last30Days: totals.rows[0], events: events.rows };
}

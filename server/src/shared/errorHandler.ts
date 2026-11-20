import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors.ts';
import { logger } from './logger.ts';

/** Postgres constraint failures that have a plain-language meaning. */
function databaseMessage(err: { code?: string; constraint?: string }): [number, string] | null {
    if (err.code === '23505') {
        const onShelf = err.constraint === 'shelves_name_key';
        return [
            409,
            onShelf
                ? 'A shelf with that name already exists.'
                : 'Another item already has that barcode.',
        ];
    }
    if (err.code === '23503') return [400, 'That shelf no longer exists.'];
    return null;
}

/** The one place a failed request is turned into a response. */
export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (err instanceof AppError) {
        res.status(err.status).json({ error: err.message });
        return;
    }
    const known = databaseMessage(err as { code?: string; constraint?: string });
    if (known) {
        res.status(known[0]).json({ error: known[1] });
        return;
    }
    // body-parser marks malformed or oversized JSON with a status.
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 413) {
        res.status(status).json({ error: 'The request could not be read.' });
        return;
    }
    logger.error({ err }, 'Unhandled request error');
    res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
}

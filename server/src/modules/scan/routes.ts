import { Router } from 'express';
import { normalizeBarcode } from '../../shared/barcode.ts';
import { badRequest } from '../../shared/errors.ts';
import { optionalShelfId } from '../../shared/parse.ts';
import type { ModuleContext } from '../context.ts';
import { scan } from './service.ts';

export function scanRouter({ pool, lookup, auth }: ModuleContext): Router {
    const router = Router();

    router.post('/scan', auth.requireEdit, async (req, res) => {
        const body = req.body ?? {};
        const barcode = normalizeBarcode(body.barcode);
        if (!barcode) throw badRequest('That does not look like a product barcode. Scan it again.');
        const mode = body.mode === 'out' ? 'out' : 'in';
        const shelfId = optionalShelfId(body.shelfId);
        res.json(await scan({ pool, lookup }, { barcode, mode, shelfId }));
    });

    return router;
}

import { Router } from 'express';
import { idParam } from '../../shared/parse.ts';
import type { ModuleContext } from '../context.ts';
import * as products from './service.ts';
import { parseNewProduct, parseProductChanges, parseStockChange } from './validation.ts';

export function productsRouter({ pool, auth }: ModuleContext): Router {
    const router = Router();

    router.get('/products', auth.requireView, async (_req, res) => {
        res.json(await products.listProducts(pool));
    });

    router.post('/products', auth.requireEdit, async (req, res) => {
        res.status(201).json(await products.createProduct(pool, parseNewProduct(req.body ?? {})));
    });

    router.patch('/products/:id', auth.requireEdit, async (req, res) => {
        res.json(
            await products.updateProduct(pool, idParam(req), parseProductChanges(req.body ?? {}))
        );
    });

    router.delete('/products/:id', auth.requireEdit, async (req, res) => {
        await products.deleteProduct(pool, idParam(req));
        res.status(204).end();
    });

    router.post('/products/:id/stock', auth.requireEdit, async (req, res) => {
        const id = idParam(req);
        const { delta, reason } = parseStockChange(req.body ?? {});
        res.json(await products.adjustStock(pool, id, delta, reason));
    });

    return router;
}

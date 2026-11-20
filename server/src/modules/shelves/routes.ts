import { Router } from 'express';
import { idParam, optionalText, requiredText } from '../../shared/parse.ts';
import type { ModuleContext } from '../context.ts';
import * as shelves from './service.ts';

export function shelvesRouter({ pool, auth }: ModuleContext): Router {
    const router = Router();

    router.get('/shelves', auth.requireView, async (_req, res) => {
        res.json(await shelves.listShelves(pool));
    });

    router.post('/shelves', auth.requireEdit, async (req, res) => {
        const name = requiredText(req.body?.name, 'Shelf name', 60);
        const notes = optionalText(req.body?.notes, 'Notes', 300) ?? '';
        res.status(201).json(await shelves.createShelf(pool, { name, notes }));
    });

    router.patch('/shelves/:id', auth.requireEdit, async (req, res) => {
        const name =
            req.body?.name === undefined
                ? undefined
                : requiredText(req.body.name, 'Shelf name', 60);
        const notes = optionalText(req.body?.notes, 'Notes', 300);
        res.json(await shelves.updateShelf(pool, idParam(req), { name, notes }));
    });

    router.delete('/shelves/:id', auth.requireEdit, async (req, res) => {
        await shelves.deleteShelf(pool, idParam(req));
        res.status(204).end();
    });

    return router;
}

import { Router } from 'express';
import type { ModuleContext } from '../context.ts';
import { recentActivity } from './service.ts';

export function activityRouter({ pool, auth }: ModuleContext): Router {
    const router = Router();

    router.get('/activity', auth.requireView, async (_req, res) => {
        res.json(await recentActivity(pool));
    });

    return router;
}

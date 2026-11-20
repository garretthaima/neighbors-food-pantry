import path from 'node:path';
import express from 'express';
import { createAuth, modules } from './modules/index.ts';
import type { AppDeps } from './modules/index.ts';
import { errorHandler } from './shared/errorHandler.ts';
import { notFound } from './shared/errors.ts';

export type { AppDeps };

/** Builds the app from its modules. Holds no routes of its own but /health. */
export function createApp(deps: AppDeps): express.Express {
    const { pool, config } = deps;
    const app = express();

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

    const ctx = { ...deps, auth: createAuth(config) };
    for (const module of modules) api.use(module.router(ctx));

    api.use(() => {
        throw notFound();
    });

    if (config.webDist) {
        const dist = path.resolve(config.webDist);
        app.use(express.static(dist, { index: false, maxAge: '1h' }));
        // Any other GET is a page inside the single-page app.
        app.use((req, res, next) => {
            if (req.method !== 'GET') return next();
            res.set('Cache-Control', 'no-cache');
            res.sendFile(path.join(dist, 'index.html'));
        });
    }

    app.use(errorHandler);
    return app;
}

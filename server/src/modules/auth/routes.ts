import { Router } from 'express';
import type { ModuleContext } from '../context.ts';

export function authRouter({ auth, config }: ModuleContext): Router {
    const router = Router();

    router.get('/me', (req, res) => {
        res.json({ role: auth.roleOf(req), viewNeedsPin: Boolean(config.viewPin) });
    });
    router.post('/login', auth.login);
    router.post('/logout', auth.logout);

    return router;
}

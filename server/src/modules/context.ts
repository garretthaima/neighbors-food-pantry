import type { Router } from 'express';
import type pg from 'pg';
import type { Config } from '../config.ts';
import type { Auth } from './auth/index.ts';
import type { Lookup } from './scan/index.ts';

/** What the process hands the app: its outside-world connections. */
export interface AppDeps {
    pool: pg.Pool;
    config: Config;
    lookup: Lookup;
}

/** What every module's router factory receives. */
export interface ModuleContext extends AppDeps {
    auth: Auth;
}

/** A feature module: a name and the routes it mounts under /api. */
export interface Module {
    name: string;
    router: (ctx: ModuleContext) => Router;
}

import type { Module } from '../context.ts';
import { authRouter } from './routes.ts';

export const authModule: Module = { name: 'auth', router: authRouter };

export { createAuth } from './session.ts';
export type { Auth, Role } from './session.ts';

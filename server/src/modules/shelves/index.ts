import type { Module } from '../context.ts';
import { shelvesRouter } from './routes.ts';

export const shelvesModule: Module = { name: 'shelves', router: shelvesRouter };

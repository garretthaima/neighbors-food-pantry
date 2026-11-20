import type { Module } from '../context.ts';
import { scanRouter } from './routes.ts';

export const scanModule: Module = { name: 'scan', router: scanRouter };

export { createLookup } from './lookup.ts';
export type { Lookup, ProductInfo } from './lookup.ts';

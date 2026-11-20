import type { Module } from '../context.ts';
import { productsRouter } from './routes.ts';

export const productsModule: Module = { name: 'products', router: productsRouter };

// What other modules may use.
export { changeStock, createFromLookup, findIdByBarcode, getProduct, setShelf } from './service.ts';

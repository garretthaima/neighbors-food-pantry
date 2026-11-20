// The composition list. A new module is added here, in mount order.
import { activityModule } from './activity/index.ts';
import { authModule } from './auth/index.ts';
import type { Module } from './context.ts';
import { productsModule } from './products/index.ts';
import { scanModule } from './scan/index.ts';
import { shelvesModule } from './shelves/index.ts';

export const modules: Module[] = [
    authModule,
    productsModule,
    scanModule,
    shelvesModule,
    activityModule,
];

export { createAuth } from './auth/index.ts';
export type { AppDeps, Module, ModuleContext } from './context.ts';

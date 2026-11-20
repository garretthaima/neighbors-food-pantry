import type { Module } from '../context.ts';
import { activityRouter } from './routes.ts';

export const activityModule: Module = { name: 'activity', router: activityRouter };

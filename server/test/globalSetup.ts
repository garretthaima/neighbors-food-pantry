// Starts one throwaway Postgres for the whole test run. Each test file
// then makes its own database inside it (see helpers/testApp.ts).
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { TestProject } from 'vitest/node';
import { LOCAL_DATABASE, localPostgres } from '../scripts/local-postgres.ts';

declare module 'vitest' {
    export interface ProvidedContext {
        pgPort: number;
    }
}

export default async function setup(project: TestProject) {
    const port = 54400 + Math.floor(Math.random() * 500);
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'pantry-test-'));
    const postgres = localPostgres({ dataDir, port, persistent: false });
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase(LOCAL_DATABASE);
    project.provide('pgPort', port);

    return async () => {
        await postgres.stop();
        await rm(dataDir, { recursive: true, force: true });
    };
}

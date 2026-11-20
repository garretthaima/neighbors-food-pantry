import { readdir } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../test/helpers/testApp.ts';
import { migrate } from '../db.ts';

const pool = await createTestDatabase();
afterAll(() => pool.end());

describe('migrations', () => {
    it('applies every file once, in name order, and nothing on a second run', async () => {
        const files = (await readdir(new URL('../../../migrations', import.meta.url))).filter((f) =>
            f.endsWith('.sql')
        );
        expect(files.length).toBeGreaterThan(0);
        expect(await migrate(pool)).toEqual(files.sort());
        expect(await migrate(pool)).toEqual([]);
    });
});

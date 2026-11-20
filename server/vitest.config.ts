import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // A module's tests live in its __tests__ folder. test/ holds helpers
        // and the repo-wide structure test.
        include: ['src/**/__tests__/**/*.test.ts', 'test/*.test.ts'],
        globalSetup: ['test/globalSetup.ts'],
        // Starting the throwaway Postgres takes a few seconds.
        hookTimeout: 120_000,
    },
});

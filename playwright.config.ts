import { defineConfig } from '@playwright/test';

const PORT = 4100;

export default defineConfig({
    testDir: 'e2e',
    // One shared database, and the specs build on each other's data.
    workers: 1,
    fullyParallel: false,
    reporter: [['list']],
    use: {
        baseURL: `http://localhost:${PORT}`,
        screenshot: 'only-on-failure',
    },
    // Phone first: 360px is the width the layout is designed for.
    projects: [
        { name: 'phone', use: { viewport: { width: 360, height: 740 }, hasTouch: true } },
        { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    ],
    webServer: {
        command: 'node server/scripts/e2e-server.ts',
        url: `http://localhost:${PORT}/api/health`,
        env: { PORT: String(PORT) },
        reuseExistingServer: false,
        timeout: 60_000,
    },
});

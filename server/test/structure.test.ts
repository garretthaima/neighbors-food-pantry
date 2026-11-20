// Keeps the repo organised: where files may live, how long they may be and
// what may import what. The rules are written up in .claude/rules/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER = 'server/src';
const WEB = 'web/src';

/** Line limits by path, first match wins. Lines are counted as `wc -l` does. */
const LIMITS: [RegExp, number][] = [
    [/(\.test\.ts|\.spec\.ts)$/, 800],
    [/^server\/test\//, 300],
    [/^server\/src\/modules\/[^/]+\/routes\.ts$/, 300],
    [/^server\/src\/modules\//, 400],
    [/^server\/src\//, 300],
    [/^server\/scripts\//, 300],
    [/^web\/src\/.*\.css$/, 300],
    [/^web\/src\//, 300],
    [/^e2e\//, 800],
];

/** Files allowed over their limit, each with the reason. Keep this empty. */
const SIZE_EXCEPTIONS: Record<string, string> = {};

function walk(dir: string): string[] {
    return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
        const rel = `${dir}/${name}`;
        return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
    });
}

function entries(dir: string): string[] {
    return readdirSync(path.join(ROOT, dir)).sort();
}

function read(file: string): string {
    return readFileSync(path.join(ROOT, file), 'utf8');
}

/** Every module specifier a file imports or re-exports. */
function imports(file: string): string[] {
    const found = read(file).matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g);
    return [...found].map((match) => match[1]!);
}

const serverFiles = walk(SERVER).filter((f) => f.endsWith('.ts'));
const webFiles = walk(WEB).filter((f) => /\.tsx?$/.test(f));
const modules = entries(`${SERVER}/modules`).filter((name) => !name.endsWith('.ts'));
const features = entries(`${WEB}/features`);

describe('file sizes', () => {
    it('keeps every source file under its line limit', () => {
        const files = [
            ...walk('server/src'),
            ...walk('server/test'),
            ...walk('server/scripts'),
            ...walk(WEB),
            ...walk('e2e'),
        ];
        const tooLong = files.flatMap((file) => {
            const limit = LIMITS.find(([pattern]) => pattern.test(file))?.[1];
            if (!limit || file in SIZE_EXCEPTIONS) return [];
            const lines = read(file).split('\n').length - 1;
            return lines > limit ? [`${file}: ${lines} lines, limit ${limit}`] : [];
        });
        expect(tooLong, 'Split these files (see .claude/rules/file-size-conventions.md)').toEqual(
            []
        );
    });
});

describe('server layout', () => {
    it('has only the entry files and the two tiers at the top of src', () => {
        expect(entries(SERVER)).toEqual(['app.ts', 'config.ts', 'index.ts', 'modules', 'shared']);
    });

    it('gives every module an index.ts and lists it in modules/index.ts', () => {
        const composition = read(`${SERVER}/modules/index.ts`);
        for (const name of modules) {
            expect(entries(`${SERVER}/modules/${name}`), `modules/${name}`).toContain('index.ts');
            expect(composition, `modules/index.ts should import ./${name}/index.ts`).toContain(
                `'./${name}/index.ts'`
            );
        }
    });

    it('lets a module reach another module only through its index.ts', () => {
        const bad: string[] = [];
        for (const file of serverFiles) {
            const own = file.match(/^server\/src\/modules\/([^/]+)\//)?.[1];
            for (const spec of imports(file).filter((s) => s.startsWith('.'))) {
                const target = path.posix.normalize(`${path.posix.dirname(file)}/${spec}`);
                const other = target.match(/^server\/src\/modules\/([^/]+)\/(.+)$/);
                if (!other) continue;
                if (!own && file.startsWith(`${SERVER}/shared/`))
                    bad.push(`${file} -> ${spec} (shared must not import a module)`);
                else if (other[1] !== own && other[2] !== 'index.ts')
                    bad.push(`${file} -> ${spec}`);
            }
        }
        expect(bad).toEqual([]);
    });

    it('keeps SQL out of routes and HTTP out of services', () => {
        const bad: string[] = [];
        for (const file of serverFiles.filter(
            (f) => f.includes('/modules/') && !f.includes('__tests__')
        )) {
            const source = read(file);
            if (file.endsWith('/routes.ts') && /\.query\s*[(<]/.test(source))
                bad.push(`${file}: runs a query; move it to service.ts`);
            if (file.endsWith('/service.ts') && /from 'express'/.test(source))
                bad.push(`${file}: imports express`);
        }
        expect(bad).toEqual([]);
    });

    it('logs through the shared logger', () => {
        const bad = serverFiles.filter((file) => /\bconsole\.\w+\(/.test(read(file)));
        expect(bad, 'Use shared/logger.ts instead of console').toEqual([]);
    });
});

describe('web layout', () => {
    it('has only main.tsx and the three tiers at the top of src', () => {
        expect(entries(WEB)).toEqual(['app', 'features', 'main.tsx', 'shared']);
    });

    it('gives every feature an index.ts', () => {
        for (const name of features)
            expect(entries(`${WEB}/features/${name}`), `features/${name}`).toContain('index.ts');
    });

    it('keeps imports inside the tiers', () => {
        const bad: string[] = [];
        for (const file of webFiles) {
            const tier = file.split('/')[2]!;
            const own = tier === 'features' ? file.split('/')[3] : undefined;
            for (const spec of imports(file)) {
                if (spec.startsWith('..'))
                    bad.push(`${file} -> ${spec} (use the @/ alias to leave a folder)`);
                const feature = spec.match(/^@\/features\/([^/]+)(\/.*)?$/);
                if (feature) {
                    if (tier === 'shared')
                        bad.push(`${file} -> ${spec} (shared must not import a feature)`);
                    else if (feature[1] === own)
                        bad.push(`${file} -> ${spec} (import your own files with ./)`);
                    else if (feature[2] && !feature[2].endsWith('.css'))
                        bad.push(`${file} -> ${spec} (go through the feature's index.ts)`);
                }
                if (spec.startsWith('@/app/') && tier !== 'app' && tier !== 'main.tsx')
                    bad.push(`${file} -> ${spec} (only main.tsx imports app)`);
            }
        }
        expect(bad).toEqual([]);
    });

    it('loads every stylesheet from app/styles.ts, in one ordered list', () => {
        const listed = imports(`${WEB}/app/styles.ts`).filter(
            (spec) => spec.endsWith('.css') && !spec.startsWith('@fontsource')
        );
        const resolved = listed.map((spec) =>
            spec.startsWith('@/') ? `${WEB}/${spec.slice(2)}` : `${WEB}/app/${spec.slice(2)}`
        );
        expect(resolved.sort()).toEqual(
            walk(WEB)
                .filter((f) => f.endsWith('.css'))
                .sort()
        );
    });
});

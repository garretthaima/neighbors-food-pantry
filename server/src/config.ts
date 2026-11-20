export interface Config {
    port: number;
    /** Unset means node-postgres reads PGHOST, PGUSER, PGPASSWORD, PGDATABASE. */
    databaseUrl: string | undefined;
    editPin: string;
    /** Empty string means anyone with the link can view. */
    viewPin: string;
    sessionSecret: string;
    lookupUserAgent: string;
    /** Folder holding the built web app, or null when it has not been built. */
    webDist: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const missing = ['EDIT_PIN', 'SESSION_SECRET'].filter((key) => !env[key]);
    if (!env.DATABASE_URL && !env.PGHOST)
        missing.push('DATABASE_URL (or PGHOST and the other PG* variables)');
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    return {
        port: Number(env.PORT ?? 4000),
        databaseUrl: env.DATABASE_URL || undefined,
        editPin: env.EDIT_PIN!,
        viewPin: env.VIEW_PIN ?? '',
        sessionSecret: env.SESSION_SECRET!,
        lookupUserAgent: env.LOOKUP_USER_AGENT || 'pantry-inventory/0.1',
        webDist: env.WEB_DIST ?? null,
    };
}

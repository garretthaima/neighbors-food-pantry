import EmbeddedPostgres from 'embedded-postgres';

export const LOCAL_USER = 'pantry';
export const LOCAL_PASSWORD = 'pantry';
export const LOCAL_DATABASE = 'pantry';

/** A real Postgres from an npm package, for development and tests only. */
export function localPostgres(options: { dataDir: string; port: number; persistent: boolean }): EmbeddedPostgres {
  return new EmbeddedPostgres({
    databaseDir: options.dataDir,
    user: LOCAL_USER,
    password: LOCAL_PASSWORD,
    port: options.port,
    persistent: options.persistent,
    // The library asks initdb for en_US.UTF-8, which minimal Linux installs
    // (WSL, CI images) do not have. C.UTF-8 exists everywhere.
    initdbFlags: ['--locale=C.UTF-8', '--lc-messages=C'],
    onLog: () => {},
  });
}

export function localUrl(port: number): string {
  return `postgres://${LOCAL_USER}:${LOCAL_PASSWORD}@localhost:${port}/${LOCAL_DATABASE}`;
}

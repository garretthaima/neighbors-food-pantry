import pino from 'pino';

/**
 * JSON logs on stdout. The fields object goes first, the message second:
 * `logger.info({ port }, 'Listening')`. Log an Error under the `err` key.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL ?? (process.env.VITEST ? 'silent' : 'info'),
});

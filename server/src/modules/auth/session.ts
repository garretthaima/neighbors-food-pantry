import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Config } from '../../config.ts';
import { forbidden, tooManyRequests, unauthorized } from '../../shared/errors.ts';

export type Role = 'viewer' | 'editor';

const COOKIE = 'pantry_session';
const SESSION_DAYS = 30;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

function sameString(a: string, b: string): boolean {
    // Hash first so the comparison is constant-time whatever the lengths.
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    return timingSafeEqual(ha, hb);
}

function sign(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('base64url');
}

function readCookie(req: Request, name: string): string | null {
    for (const part of (req.headers.cookie ?? '').split(';')) {
        const [key, ...rest] = part.trim().split('=');
        if (key === name) return rest.join('=');
    }
    return null;
}

function roleForPin(config: Config, pin: string): Role | null {
    if (sameString(pin, config.editPin)) return 'editor';
    if (config.viewPin && sameString(pin, config.viewPin)) return 'viewer';
    return null;
}

/** The role a session cookie proves, or null if it is missing, forged or expired. */
function roleInCookie(config: Config, req: Request): Role | null {
    const [role, expires, signature] = (readCookie(req, COOKIE) ?? '').split('.');
    if (role !== 'viewer' && role !== 'editor') return null;
    if (!expires || !signature || Number(expires) <= Date.now()) return null;
    return sameString(signature, sign(`${role}.${expires}`, config.sessionSecret)) ? role : null;
}

function setSessionCookie(config: Config, req: Request, res: Response, role: Role): void {
    const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    const payload = `${role}.${expires}`;
    res.cookie(COOKIE, `${payload}.${sign(payload, config.sessionSecret)}`, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure,
        expires: new Date(expires),
        path: '/',
    });
}

/** Counts wrong PINs per address, in memory. A restart clears it. */
function createLockout() {
    const failures = new Map<string, { count: number; resetAt: number }>();
    const current = (ip: string) => {
        const record = failures.get(ip);
        return record && record.resetAt > Date.now() ? record : undefined;
    };
    return {
        isLocked: (ip: string) => (current(ip)?.count ?? 0) >= MAX_FAILURES,
        fail(ip: string) {
            const record = current(ip);
            if (record) record.count += 1;
            else failures.set(ip, { count: 1, resetAt: Date.now() + FAILURE_WINDOW_MS });
        },
        clear: (ip: string) => failures.delete(ip),
    };
}

export function createAuth(config: Config) {
    const lockout = createLockout();

    /** The role this request has: from its cookie, else viewer if viewing is open. */
    function roleOf(req: Request): Role | null {
        return roleInCookie(config, req) ?? (config.viewPin ? null : 'viewer');
    }

    function login(req: Request, res: Response): void {
        const ip = req.ip ?? 'unknown';
        if (lockout.isLocked(ip)) {
            throw tooManyRequests('Too many wrong PINs. Wait 15 minutes and try again.');
        }
        const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
        const role = pin ? roleForPin(config, pin) : null;
        if (!role) {
            lockout.fail(ip);
            throw unauthorized('That PIN is not right.');
        }
        lockout.clear(ip);
        setSessionCookie(config, req, res, role);
        res.json({ role });
    }

    function logout(_req: Request, res: Response): void {
        res.clearCookie(COOKIE, { path: '/' });
        res.json({ role: config.viewPin ? null : 'viewer' });
    }

    function requireView(req: Request, _res: Response, next: NextFunction): void {
        next(roleOf(req) ? undefined : unauthorized('Enter the PIN to see the pantry.'));
    }

    function requireEdit(req: Request, _res: Response, next: NextFunction): void {
        const allowed = roleOf(req) === 'editor';
        next(allowed ? undefined : forbidden('Enter the volunteer PIN to make changes.'));
    }

    return { roleOf, login, logout, requireView, requireEdit };
}

export type Auth = ReturnType<typeof createAuth>;

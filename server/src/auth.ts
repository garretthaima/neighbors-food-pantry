import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Config } from './config.ts';

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

export function createAuth(config: Config) {
  const failures = new Map<string, { count: number; resetAt: number }>();

  function roleForPin(pin: string): Role | null {
    if (sameString(pin, config.editPin)) return 'editor';
    if (config.viewPin && sameString(pin, config.viewPin)) return 'viewer';
    return null;
  }

  /** The role this request has: from its cookie, else viewer if viewing is open. */
  function roleOf(req: Request): Role | null {
    const cookie = readCookie(req, COOKIE);
    if (cookie) {
      const [role, expires, signature] = cookie.split('.');
      if (
        (role === 'viewer' || role === 'editor') &&
        expires &&
        signature &&
        sameString(signature, sign(`${role}.${expires}`, config.sessionSecret)) &&
        Number(expires) > Date.now()
      ) {
        return role;
      }
    }
    return config.viewPin ? null : 'viewer';
  }

  function login(req: Request, res: Response): void {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const record = failures.get(ip);
    if (record && record.resetAt > now && record.count >= MAX_FAILURES) {
      res.status(429).json({ error: 'Too many wrong PINs. Wait 15 minutes and try again.' });
      return;
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
    const role = pin ? roleForPin(pin) : null;
    if (!role) {
      if (record && record.resetAt > now) record.count += 1;
      else failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
      res.status(401).json({ error: 'That PIN is not right.' });
      return;
    }

    failures.delete(ip);
    const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
    const payload = `${role}.${expires}`;
    res.cookie(COOKIE, `${payload}.${sign(payload, config.sessionSecret)}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      expires: new Date(expires),
      path: '/',
    });
    res.json({ role });
  }

  function logout(_req: Request, res: Response): void {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ role: config.viewPin ? null : 'viewer' });
  }

  function requireView(req: Request, res: Response, next: NextFunction): void {
    if (roleOf(req)) next();
    else res.status(401).json({ error: 'Enter the PIN to see the pantry.' });
  }

  function requireEdit(req: Request, res: Response, next: NextFunction): void {
    if (roleOf(req) === 'editor') next();
    else res.status(403).json({ error: 'Enter the volunteer PIN to make changes.' });
  }

  return { roleOf, login, logout, requireView, requireEdit };
}

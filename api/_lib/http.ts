import { SignJWT, jwtVerify } from 'jose';
import type { VercelRequest, VercelResponse } from './vercel.js';

/** Read JWT secret from env. */
function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 chars)');
  }

  return new TextEncoder().encode(secret);
}

/** Issue a short-lived session JWT for an account. */
export async function signSession(accountId: string): Promise<string> {
  return new SignJWT({ accountId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(jwtSecret());
}

/** Extract the raw Bearer token from an Authorization header. */
export function bearerToken(req: VercelRequest): string {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;

  return header?.startsWith('Bearer ') ? header.slice(7) : '';
}

/** Verify Bearer JWT and return accountId. */
export async function verifySession(req: VercelRequest): Promise<string | null> {
  const token = bearerToken(req);

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    const accountId = payload.accountId;

    if (typeof accountId !== 'string') {
      return null;
    }

    return accountId;
  } catch {
    return null;
  }
}

/** Apply CORS headers for browser clients. */
export function applyCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Handle OPTIONS preflight; returns true if handled. */
export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();

    return true;
  }

  return false;
}

/** JSON error helper. */
export function sendError(res: VercelResponse, status: number, message: string): void {
  applyCors(res);
  res.status(status).json({ error: message });
}

/** JSON success helper. */
export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  applyCors(res);
  res.status(status).json(body);
}

/** Timing-safe string compare for hex secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let out = 0;

  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return out === 0;
}

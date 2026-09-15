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

/** Origins allowed to call the API cross-site; defaults to local dev only. */
function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;

  return raw
    ? raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : ['http://localhost:5173'];
}

/** Apply CORS headers, echoing the request Origin only when allowlisted. */
export function applyCors(req: VercelRequest, res: VercelResponse): void {
  const raw = req.headers.origin;
  const origin = Array.isArray(raw) ? raw[0] : raw;

  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Handle OPTIONS preflight; returns true if handled. */
export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();

    return true;
  }

  return false;
}

/** JSON error helper. */
export function sendError(
  req: VercelRequest,
  res: VercelResponse,
  status: number,
  message: string,
): void {
  applyCors(req, res);
  res.status(status).json({ error: message });
}

/** JSON success helper. */
export function sendJson(
  req: VercelRequest,
  res: VercelResponse,
  status: number,
  body: unknown,
): void {
  applyCors(req, res);
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

export type RecoverAuthResult = 'ok' | 'legacy' | 'mismatch';

/**
 * Decide whether a recover request may proceed. Pulled out of api/auth/recover.ts
 * so this security-critical branch is unit-testable without a live Mongo — see
 * scripts/auth-check.ts.
 */
export function checkRecoverAuth(
  storedDekVerifier: string | undefined,
  providedDekVerifier: string,
): RecoverAuthResult {
  if (!storedDekVerifier) {
    return 'legacy';
  }

  return safeEqual(storedDekVerifier, providedDekVerifier) ? 'ok' : 'mismatch';
}

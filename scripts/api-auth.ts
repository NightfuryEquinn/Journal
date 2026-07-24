import { SignJWT, jwtVerify } from 'jose';

/** Read JWT secret from env (dev default for local only). */
function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'journs-dev-jwt-secret-change-me';

  return new TextEncoder().encode(secret);
}

/** Timing-safe string compare. */
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

/** Issue session JWT. */
export async function signSession(accountId: string): Promise<string> {
  return new SignJWT({ accountId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(jwtSecret());
}

/** Verify Authorization header Bearer token → accountId. */
export async function verifySession(authorization: string | null): Promise<string | null> {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(authorization.slice(7), jwtSecret());

    return typeof payload.accountId === 'string' ? payload.accountId : null;
  } catch {
    return null;
  }
}

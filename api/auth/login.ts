import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { loginBodySchema } from '../_lib/schemas.js';
import { touchActive, usersCol } from '../_lib/db.js';
import { handleOptions, safeEqual, sendError, sendJson, signSession } from '../_lib/http.js';

/** Login with accountId + auth verifier; returns JWT and wrapped DEKs. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');

    return;
  }

  const parsed = loginBodySchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 400, 'Invalid login body');

    return;
  }

  const { accountId, authVerifier } = parsed.data;
  const user = await (await usersCol()).findOne({ accountId });

  if (!user || !safeEqual(user.authVerifier, authVerifier)) {
    sendError(res, 401, 'Invalid credentials');

    return;
  }

  await touchActive(accountId);
  const token = await signSession(accountId);

  sendJson(res, 200, {
    token,
    accountId: user.accountId,
    salt: user.salt,
    wrappedDekPass: user.wrappedDekPass,
    wrappedDekRecovery: user.wrappedDekRecovery,
    createdAt: user.createdAt.toISOString(),
  });
}

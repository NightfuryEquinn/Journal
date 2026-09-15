import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { recoverBodySchema } from '../_lib/schemas.js';
import { usersCol } from '../_lib/db.js';
import { checkRecoverAuth, handleOptions, sendError, sendJson, signSession } from '../_lib/http.js';

/**
 * Rotate passphrase wrap + auth verifier after client unwrapped DEK via recovery phrase.
 *
 * `dekVerifier` proves the caller actually unwrapped the DEK (via mnemonic or
 * passphrase) — without it, anyone who learns an accountId could overwrite a
 * stranger's wraps and lock them out for good. See src/crypto.ts deriveDekVerifier.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendError(req, res, 405, 'Method not allowed');

    return;
  }

  const parsed = recoverBodySchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(req, res, 400, 'Invalid recover body');

    return;
  }

  const body = parsed.data;
  const users = await usersCol();
  const user = await users.findOne({ accountId: body.accountId });

  if (!user) {
    sendError(req, res, 404, 'Account not found');

    return;
  }

  const authResult = checkRecoverAuth(user.dekVerifier, body.dekVerifier);

  if (authResult === 'legacy') {
    sendError(
      req,
      res,
      409,
      'Account predates recovery verification — unlock with your passphrase once first',
    );

    return;
  }

  if (authResult === 'mismatch') {
    sendError(req, res, 401, 'Invalid recovery credentials');

    return;
  }

  const now = new Date();

  await users.updateOne(
    { accountId: body.accountId },
    {
      $set: {
        salt: body.salt,
        wrappedDekPass: body.wrappedDekPass,
        wrappedDekRecovery: body.wrappedDekRecovery,
        authVerifier: body.authVerifier,
        dekVerifier: body.dekVerifier,
        lastActiveAt: now,
        updatedAt: now,
      },
    },
  );

  const token = await signSession(body.accountId);

  sendJson(req, res, 200, {
    token,
    accountId: body.accountId,
    salt: body.salt,
    wrappedDekPass: body.wrappedDekPass,
    wrappedDekRecovery: body.wrappedDekRecovery,
    createdAt: user.createdAt.toISOString(),
  });
}

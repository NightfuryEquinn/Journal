import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { recoverBodySchema } from '../_lib/schemas.js';
import { usersCol } from '../_lib/db.js';
import { handleOptions, sendError, sendJson, signSession } from '../_lib/http.js';

/**
 * Rotate passphrase wrap + auth verifier after client unwrapped DEK via recovery phrase.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');

    return;
  }

  const parsed = recoverBodySchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 400, 'Invalid recover body');

    return;
  }

  const body = parsed.data;
  const users = await usersCol();
  const user = await users.findOne({ accountId: body.accountId });

  if (!user) {
    sendError(res, 404, 'Account not found');

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
        lastActiveAt: now,
        updatedAt: now,
      },
    },
  );

  const token = await signSession(body.accountId);

  sendJson(res, 200, {
    token,
    accountId: body.accountId,
    salt: body.salt,
    wrappedDekPass: body.wrappedDekPass,
    wrappedDekRecovery: body.wrappedDekRecovery,
    createdAt: user.createdAt.toISOString(),
  });
}

import type { VercelRequest, VercelResponse } from '../_lib/vercel';
import { hexString } from '../_lib/schemas';
import { usersCol } from '../_lib/db';
import { handleOptions, sendError, sendJson } from '../_lib/http';

/**
 * Fetch recovery wrap material by accountId (derived from mnemonic on the client).
 * Ciphertext is useless without the recovery phrase KEK.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');

    return;
  }

  const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : '';
  const parsed = hexString.safeParse(accountId);

  if (!parsed.success) {
    sendError(res, 400, 'Invalid accountId');

    return;
  }

  const user = await (await usersCol()).findOne({ accountId: parsed.data });

  if (!user) {
    sendError(res, 404, 'Account not found');

    return;
  }

  sendJson(res, 200, {
    accountId: user.accountId,
    salt: user.salt,
    wrappedDekRecovery: user.wrappedDekRecovery,
    createdAt: user.createdAt.toISOString(),
  });
}

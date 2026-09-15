import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { setDekVerifierBodySchema } from '../_lib/schemas.js';
import { usersCol } from '../_lib/db.js';
import { handleOptions, sendError, sendJson, verifySession } from '../_lib/http.js';

/**
 * Backfill dekVerifier for accounts that predate it. JWT-authed only — a
 * successful login already proved passphrase possession, which is as strong
 * a guarantee as the check this value exists to make. No-ops if already set.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendError(req, res, 405, 'Method not allowed');

    return;
  }

  const accountId = await verifySession(req);

  if (!accountId) {
    sendError(req, res, 401, 'Unauthorized');

    return;
  }

  const parsed = setDekVerifierBodySchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(req, res, 400, 'Invalid verifier body');

    return;
  }

  const users = await usersCol();
  const user = await users.findOne({ accountId });

  if (!user) {
    sendError(req, res, 404, 'Account not found');

    return;
  }

  if (!user.dekVerifier) {
    await users.updateOne(
      { accountId },
      { $set: { dekVerifier: parsed.data.dekVerifier, updatedAt: new Date() } },
    );
  }

  sendJson(req, res, 200, { ok: true });
}

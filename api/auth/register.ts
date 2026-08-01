import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { emptyProgress } from '../../shared/quests.js';
import { registerBodySchema } from '../_lib/schemas.js';
import { questProgressCol, usersCol } from '../_lib/db.js';
import { handleOptions, sendError, sendJson, signSession } from '../_lib/http.js';

/** Register a new E2EE account with wrapped DEKs and auth verifier. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');

    return;
  }

  const parsed = registerBodySchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 400, 'Invalid register body');

    return;
  }

  const body = parsed.data;
  const users = await usersCol();
  const existing = await users.findOne({ accountId: body.accountId });

  if (existing) {
    sendError(res, 409, 'Account already exists');

    return;
  }

  const now = new Date();

  await users.insertOne({
    accountId: body.accountId,
    salt: body.salt,
    wrappedDekPass: body.wrappedDekPass,
    wrappedDekRecovery: body.wrappedDekRecovery,
    authVerifier: body.authVerifier,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const progress = emptyProgress(now);
  await (await questProgressCol()).insertOne({
    accountId: body.accountId,
    ...progress,
    updatedAt: now,
  });

  const token = await signSession(body.accountId);

  sendJson(res, 201, {
    token,
    accountId: body.accountId,
    salt: body.salt,
    wrappedDekPass: body.wrappedDekPass,
    wrappedDekRecovery: body.wrappedDekRecovery,
  });
}

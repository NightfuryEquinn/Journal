import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { entriesCol, touchActive } from '../_lib/db.js';
import { handleOptions, sendError, sendJson, verifySession } from '../_lib/http.js';

/** Delete a single encrypted entry by id. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'DELETE') {
    sendError(res, 405, 'Method not allowed');

    return;
  }

  const accountId = await verifySession(req);

  if (!accountId) {
    sendError(res, 401, 'Unauthorized');

    return;
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';

  if (!id) {
    sendError(res, 400, 'Missing entry id');

    return;
  }

  const result = await (await entriesCol()).deleteOne({ accountId, entryId: id });

  if (result.deletedCount === 0) {
    sendError(res, 404, 'Entry not found');

    return;
  }

  await touchActive(accountId);
  sendJson(res, 200, { ok: true });
}

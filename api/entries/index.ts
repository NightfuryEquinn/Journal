import type { VercelRequest, VercelResponse } from '../_lib/vercel';
import { putEntriesBodySchema } from '../_lib/schemas';
import { entriesCol, touchActive } from '../_lib/db';
import { handleOptions, sendError, sendJson, verifySession } from '../_lib/http';

/** List or upsert encrypted journal entries for the authenticated account. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  const accountId = await verifySession(req);

  if (!accountId) {
    sendError(res, 401, 'Unauthorized');

    return;
  }

  if (req.method === 'GET') {
    const docs = await (await entriesCol())
      .find({ accountId })
      .project({ _id: 0, entryId: 1, ciphertext: 1, nonce: 1, schemaVersion: 1, updatedAt: 1 })
      .toArray();

    await touchActive(accountId);

    sendJson(res, 200, {
      entries: docs.map((d) => ({
        entryId: d.entryId,
        ciphertext: d.ciphertext,
        nonce: d.nonce,
        schemaVersion: d.schemaVersion,
        updatedAt: d.updatedAt.toISOString(),
      })),
    });

    return;
  }

  if (req.method === 'PUT') {
    const parsed = putEntriesBodySchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, 400, 'Invalid entries body');

      return;
    }

    const now = new Date();
    const col = await entriesCol();
    const ops = parsed.data.entries.map((e) => ({
      updateOne: {
        filter: { accountId, entryId: e.entryId },
        update: {
          $set: {
            accountId,
            entryId: e.entryId,
            ciphertext: e.ciphertext,
            nonce: e.nonce,
            schemaVersion: e.schemaVersion ?? 1,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await col.bulkWrite(ops);
    }

    await touchActive(accountId);
    sendJson(res, 200, { ok: true, count: ops.length });

    return;
  }

  sendError(res, 405, 'Method not allowed');
}

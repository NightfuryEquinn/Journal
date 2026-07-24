/**
 * Local `/api` router shared by the Vite in-process plugin.
 * Mirrors Vercel serverless routes under api/.
 */
import { emptyProgress, settleAura } from '../shared/quests';
import {
  registerBodySchema,
  loginBodySchema,
  recoverBodySchema,
  putEntriesBodySchema,
  questProgressSchema,
  hexString,
} from '../api/_lib/schemas';
import { entriesCol, questProgressCol, touchActive, usersCol } from '../api/_lib/db';
import { safeEqual, signSession, verifySession } from './api-auth';

/** Read JSON body from a Fetch Request. */
async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Extract Bearer accountId. */
async function accountFromReq(req: Request): Promise<string | null> {
  return verifySession(req.headers.get('authorization'));
}

/** JSON response helper. */
function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/** Handle a single `/api/*` Fetch request. */
export async function handleApiRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    return json(204, null);
  }

  try {
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const parsed = registerBodySchema.safeParse(await readJson(req));

      if (!parsed.success) {
        return json(400, { error: 'Invalid register body' });
      }

      const body = parsed.data;
      const users = await usersCol();

      if (await users.findOne({ accountId: body.accountId })) {
        return json(409, { error: 'Account already exists' });
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
      await (await questProgressCol()).insertOne({
        accountId: body.accountId,
        ...emptyProgress(now),
        updatedAt: now,
      });
      const token = await signSession(body.accountId);

      return json(201, {
        token,
        accountId: body.accountId,
        salt: body.salt,
        wrappedDekPass: body.wrappedDekPass,
        wrappedDekRecovery: body.wrappedDekRecovery,
      });
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const parsed = loginBodySchema.safeParse(await readJson(req));

      if (!parsed.success) {
        return json(400, { error: 'Invalid login body' });
      }

      const { accountId, authVerifier } = parsed.data;
      const user = await (await usersCol()).findOne({ accountId });

      if (!user || !safeEqual(user.authVerifier, authVerifier)) {
        return json(401, { error: 'Invalid credentials' });
      }

      await touchActive(accountId);

      return json(200, {
        token: await signSession(accountId),
        accountId: user.accountId,
        salt: user.salt,
        wrappedDekPass: user.wrappedDekPass,
        wrappedDekRecovery: user.wrappedDekRecovery,
        createdAt: user.createdAt.toISOString(),
      });
    }

    if (pathname === '/api/auth/recover' && req.method === 'POST') {
      const parsed = recoverBodySchema.safeParse(await readJson(req));

      if (!parsed.success) {
        return json(400, { error: 'Invalid recover body' });
      }

      const body = parsed.data;
      const users = await usersCol();
      const user = await users.findOne({ accountId: body.accountId });

      if (!user) {
        return json(404, { error: 'Account not found' });
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

      return json(200, {
        token: await signSession(body.accountId),
        accountId: body.accountId,
        salt: body.salt,
        wrappedDekPass: body.wrappedDekPass,
        wrappedDekRecovery: body.wrappedDekRecovery,
        createdAt: user.createdAt.toISOString(),
      });
    }

    if (pathname === '/api/auth/bundle' && req.method === 'GET') {
      const accountId = url.searchParams.get('accountId') ?? '';
      const parsed = hexString.safeParse(accountId);

      if (!parsed.success) {
        return json(400, { error: 'Invalid accountId' });
      }

      const user = await (await usersCol()).findOne({ accountId: parsed.data });

      if (!user) {
        return json(404, { error: 'Account not found' });
      }

      return json(200, {
        accountId: user.accountId,
        salt: user.salt,
        wrappedDekRecovery: user.wrappedDekRecovery,
        createdAt: user.createdAt.toISOString(),
      });
    }

    if (pathname === '/api/entries' && req.method === 'GET') {
      const accountId = await accountFromReq(req);

      if (!accountId) {
        return json(401, { error: 'Unauthorized' });
      }

      const docs = await (await entriesCol())
        .find({ accountId })
        .project({ _id: 0, entryId: 1, ciphertext: 1, nonce: 1, schemaVersion: 1, updatedAt: 1 })
        .toArray();
      await touchActive(accountId);

      return json(200, {
        entries: docs.map((d) => ({
          entryId: d.entryId,
          ciphertext: d.ciphertext,
          nonce: d.nonce,
          schemaVersion: d.schemaVersion,
          updatedAt: d.updatedAt.toISOString(),
        })),
      });
    }

    if (pathname === '/api/entries' && req.method === 'PUT') {
      const accountId = await accountFromReq(req);

      if (!accountId) {
        return json(401, { error: 'Unauthorized' });
      }

      const parsed = putEntriesBodySchema.safeParse(await readJson(req));

      if (!parsed.success) {
        return json(400, { error: 'Invalid entries body' });
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

      return json(200, { ok: true, count: ops.length });
    }

    const entryMatch = pathname.match(/^\/api\/entries\/([^/]+)$/);

    if (entryMatch && req.method === 'DELETE') {
      const accountId = await accountFromReq(req);

      if (!accountId) {
        return json(401, { error: 'Unauthorized' });
      }

      const entryId = decodeURIComponent(entryMatch[1]!);
      const result = await (await entriesCol()).deleteOne({ accountId, entryId });

      if (result.deletedCount === 0) {
        return json(404, { error: 'Entry not found' });
      }

      await touchActive(accountId);

      return json(200, { ok: true });
    }

    if (pathname === '/api/quests' && req.method === 'GET') {
      const accountId = await accountFromReq(req);

      if (!accountId) {
        return json(401, { error: 'Unauthorized' });
      }

      const col = await questProgressCol();
      const doc = await col.findOne({ accountId });

      if (!doc) {
        return json(404, { error: 'Progress not found' });
      }

      const settled = settleAura({
        aura: doc.aura,
        claimedTags: doc.claimedTags,
        period: doc.period,
        lastSettledAt: doc.lastSettledAt,
      });
      await col.updateOne({ accountId }, { $set: { ...settled, updatedAt: new Date() } });
      await touchActive(accountId);

      return json(200, { progress: settled });
    }

    if (pathname === '/api/quests' && req.method === 'PUT') {
      const accountId = await accountFromReq(req);

      if (!accountId) {
        return json(401, { error: 'Unauthorized' });
      }

      const body = (await readJson(req)) as { progress?: unknown };
      const parsed = questProgressSchema.safeParse(body?.progress ?? body);

      if (!parsed.success) {
        return json(400, { error: 'Invalid progress body' });
      }

      const progress = settleAura(parsed.data);
      const now = new Date();
      await (await questProgressCol()).updateOne(
        { accountId },
        { $set: { accountId, ...progress, updatedAt: now } },
        { upsert: true },
      );
      await touchActive(accountId);

      return json(200, { progress });
    }

    if (pathname === '/api/cron/settle' && req.method === 'POST') {
      const secret = process.env.CRON_SECRET ?? '';
      const header = req.headers.get('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';

      if (!secret || secret.length < 16 || !safeEqual(token, secret)) {
        return json(401, { error: 'Unauthorized' });
      }

      const col = await questProgressCol();
      let scanned = 0;
      let updated = 0;
      const now = new Date();

      for await (const doc of col.find({})) {
        scanned++;
        const before = {
          aura: doc.aura,
          claimedTags: doc.claimedTags,
          period: doc.period,
          lastSettledAt: doc.lastSettledAt,
        };
        const settled = settleAura(before, now);
        const changed =
          settled.aura !== before.aura ||
          settled.period.dayKey !== before.period.dayKey ||
          settled.period.weekKey !== before.period.weekKey;

        if (changed) {
          await col.updateOne(
            { accountId: doc.accountId },
            { $set: { ...settled, updatedAt: now } },
          );
          updated++;
        }
      }

      return json(200, { ok: true, scanned, updated, at: now.toISOString() });
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);

    return json(500, { error: err instanceof Error ? err.message : 'Server error' });
  }
}

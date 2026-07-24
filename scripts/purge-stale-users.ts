/**
 * Delete users inactive for more than 90 days, plus their entries and quest_progress.
 * Usage: bun run scripts/purge-stale-users.ts --confirm
 */
import { MongoClient } from 'mongodb';
import { resolveMongoUri } from '../api/_lib/resolve-uri';

const STALE_MS = 90 * 24 * 60 * 60 * 1000;
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'journs';

if (!uri) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to run without --confirm');
  console.error('Usage: bun run scripts/purge-stale-users.ts --confirm');
  process.exit(1);
}

const client = new MongoClient(await resolveMongoUri(uri));
const cutoff = new Date(Date.now() - STALE_MS);

try {
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');
  const entries = db.collection('entries');
  const quests = db.collection('quest_progress');

  const stale = await users
    .find({
      $or: [
        { lastActiveAt: { $lt: cutoff } },
        { lastActiveAt: { $exists: false }, createdAt: { $lt: cutoff } },
      ],
    })
    .project({ accountId: 1, lastActiveAt: 1, createdAt: 1 })
    .toArray();

  console.log(`Found ${stale.length} stale user(s) (inactive before ${cutoff.toISOString()})`);

  let entriesDeleted = 0;
  let questsDeleted = 0;

  for (const u of stale) {
    const accountId = u.accountId as string;
    const e = await entries.deleteMany({ accountId });
    const q = await quests.deleteMany({ accountId });
    entriesDeleted += e.deletedCount;
    questsDeleted += q.deletedCount;
    await users.deleteOne({ accountId });
    console.log(`  purged ${accountId.slice(0, 12)}… (entries=${e.deletedCount}, quests=${q.deletedCount})`);
  }

  console.log(
    `Done. users=${stale.length} entries=${entriesDeleted} quest_progress=${questsDeleted}`,
  );
} finally {
  await client.close();
}

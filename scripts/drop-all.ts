/**
 * Drop ALL collections in MONGODB_DB.
 * Usage: bun run scripts/drop-all.ts --confirm
 */
import { MongoClient } from 'mongodb';
import { resolveMongoUri } from '../api/_lib/resolve-uri';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'journs';

if (!uri) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to run without --confirm');
  console.error('Usage: bun run scripts/drop-all.ts --confirm');
  process.exit(1);
}

const client = new MongoClient(await resolveMongoUri(uri));

try {
  await client.connect();
  const db = client.db(dbName);
  const cols = await db.collections();
  console.log(`Dropping ${cols.length} collection(s) in ${dbName}…`);

  for (const col of cols) {
    await col.drop();
    console.log(`  dropped ${col.collectionName}`);
  }

  console.log('Done.');
} finally {
  await client.close();
}

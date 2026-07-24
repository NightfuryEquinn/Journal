import { MongoClient, type Db, type Collection } from 'mongodb';
import dns from 'node:dns';
import type { QuestProgress } from '../../shared/types';
import { resolveMongoUri } from './resolve-uri';

// Bun's c-ares SRV resolution hangs for Atlas hosts on Vercel
// (oven-sh/bun#25718); public resolvers make `mongodb+srv` lookups work.
// Local Windows dev uses the nslookup fallback in resolve-uri instead.
if (process.env.VERCEL) {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}

export interface UserDoc {
  accountId: string;
  salt: string;
  wrappedDekPass: string;
  wrappedDekRecovery: string;
  authVerifier: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryDoc {
  accountId: string;
  entryId: string;
  ciphertext: string;
  nonce: string;
  schemaVersion: number;
  updatedAt: Date;
}

export interface QuestProgressDoc extends QuestProgress {
  accountId: string;
  updatedAt: Date;
}

declare global {
  // eslint-disable-next-line no-var
  var _journsMongo: { client: MongoClient; db: Db } | undefined;
}

const CONNECT_TIMEOUT_MS = 12_000;

/** Connect to MongoDB Atlas (cached across warm serverless invocations). */
export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const name = process.env.MONGODB_DB || 'journs';

  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  if (globalThis._journsMongo) {
    return globalThis._journsMongo.db;
  }

  const resolved = await resolveMongoUri(uri);

  if (resolved !== uri) {
    console.log('Resolved mongodb+srv URI to direct connection (Windows DNS workaround).');
  }

  const client = new MongoClient(resolved, {
    serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
    connectTimeoutMS: CONNECT_TIMEOUT_MS,
  });
  await client.connect();
  const db = client.db(name);
  globalThis._journsMongo = { client, db };

  return db;
}

/** users collection. */
export async function usersCol(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>('users');
}

/** entries (ciphertext) collection. */
export async function entriesCol(): Promise<Collection<EntryDoc>> {
  return (await getDb()).collection<EntryDoc>('entries');
}

/** quest_progress collection. */
export async function questProgressCol(): Promise<Collection<QuestProgressDoc>> {
  return (await getDb()).collection<QuestProgressDoc>('quest_progress');
}

/** Bump lastActiveAt for an account. */
export async function touchActive(accountId: string): Promise<void> {
  const now = new Date();
  await (await usersCol()).updateOne(
    { accountId },
    { $set: { lastActiveAt: now, updatedAt: now } },
  );
}

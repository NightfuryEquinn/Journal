import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import type { JournalEntry } from './types';

const PBKDF2_ITERS = 600_000;
const TEXT = new TextEncoder();

/** Convert bytes to lowercase hex. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Parse hex string to bytes. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.toLowerCase();

  if (clean.length % 2 !== 0) {
    throw new Error('Invalid hex length');
  }

  const out = new Uint8Array(clean.length / 2);

  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  return out;
}

/** SHA-256 digest as hex. */
async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? TEXT.encode(data) : data;
  const buf = await crypto.subtle.digest('SHA-256', bytes);

  return bytesToHex(new Uint8Array(buf));
}

/** Generate a cryptographically random 12-word BIP39 mnemonic. */
export function generateRecoveryPhrase(): string[] {
  return generateMnemonic(wordlist, 128).split(' ');
}

/** Normalize recovery words to lowercase trimmed tokens. */
export function normalizePhrase(words: string[]): string[] {
  return words.map((w) => w.trim().toLowerCase()).filter(Boolean);
}

/** Join normalized words into a canonical phrase string. */
export function phraseToString(words: string[]): string {
  return normalizePhrase(words).join(' ');
}

/** Validate exactly 12 BIP39 English words. */
export function validateRecoveryWords(words: string[]): string | null {
  const normalized = normalizePhrase(words);

  if (normalized.length !== 12) {
    return 'Need exactly 12 recovery words.';
  }

  if (!validateMnemonic(phraseToString(normalized), wordlist)) {
    return 'Invalid recovery phrase.';
  }

  return null;
}

/** BIP39 seed from mnemonic (async WebCrypto-friendly). */
export async function mnemonicSeed(words: string[]): Promise<Uint8Array> {
  const err = validateRecoveryWords(words);

  if (err) {
    throw new Error(err);
  }

  return mnemonicToSeed(phraseToString(words));
}

/** Public account id derived from mnemonic seed. */
export async function deriveAccountId(seed: Uint8Array): Promise<string> {
  return sha256Hex(TEXT.encode(`journs:v1:account:${bytesToHex(seed)}`));
}

/** Short operator callsign for HUD display. */
export function operatorCallsign(accountId: string): string {
  return `op-${accountId.slice(0, 8)}`;
}

/** Random salt for PBKDF2 (32 bytes → hex). */
export function randomSalt(): string {
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);

  return bytesToHex(salt);
}

/** Random 256-bit data encryption key. */
export function randomDek(): Uint8Array {
  const dek = new Uint8Array(32);
  crypto.getRandomValues(dek);

  return dek;
}

/** Import raw AES key material. */
async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** PBKDF2-SHA-256 passphrase KEK. */
export async function derivePassKek(passphrase: string, saltHex: string): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    TEXT.encode(passphrase.trim()),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERS,
      hash: 'SHA-256',
    },
    baseKey,
    256,
  );

  return new Uint8Array(bits);
}

/** HKDF-SHA-256 expand from seed. */
async function hkdf(seed: Uint8Array, info: string, length = 32): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', seed, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: TEXT.encode(info),
    },
    key,
    length * 8,
  );

  return new Uint8Array(bits);
}

/** Recovery KEK from mnemonic seed. */
export async function deriveRecoveryKek(seed: Uint8Array): Promise<Uint8Array> {
  return hkdf(seed, 'journs-recovery-kek');
}

/** Server auth verifier from pass KEK. */
export async function deriveAuthVerifier(passKek: Uint8Array): Promise<string> {
  const authKey = await hkdf(passKek, 'journs-auth');

  return sha256Hex(authKey);
}

/**
 * AES-GCM wrap: returns hex(nonce || ciphertext||tag).
 * Stored as wrappedDek* fields (nonce prepended, 12 bytes).
 */
export async function wrapKey(kek: Uint8Array, dek: Uint8Array): Promise<string> {
  const key = await importAesKey(kek);
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, dek),
  );
  const out = new Uint8Array(nonce.length + cipher.length);
  out.set(nonce, 0);
  out.set(cipher, nonce.length);

  return bytesToHex(out);
}

/** Unwrap DEK from hex(nonce || ciphertext). */
export async function unwrapKey(kek: Uint8Array, wrappedHex: string): Promise<Uint8Array> {
  const raw = hexToBytes(wrappedHex);

  if (raw.length < 13) {
    throw new Error('Invalid wrapped key');
  }

  const nonce = raw.slice(0, 12);
  const cipher = raw.slice(12);
  const key = await importAesKey(kek);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher);

  return new Uint8Array(plain);
}

/** Encrypt a journal entry JSON blob; returns ciphertext + nonce hex. */
export async function encryptEntry(
  dek: Uint8Array,
  entry: JournalEntry,
): Promise<{ ciphertext: string; nonce: string }> {
  const key = await importAesKey(dek);
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);
  const plain = TEXT.encode(JSON.stringify(entry));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain),
  );

  return { ciphertext: bytesToHex(cipher), nonce: bytesToHex(nonce) };
}

/** Decrypt a journal entry ciphertext. */
export async function decryptEntry(
  dek: Uint8Array,
  ciphertext: string,
  nonce: string,
): Promise<JournalEntry> {
  const key = await importAesKey(dek);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(nonce) },
    key,
    hexToBytes(ciphertext),
  );
  const text = new TextDecoder().decode(plain);

  return JSON.parse(text) as JournalEntry;
}

/** Full key material produced at account create / passphrase rotate. */
export interface AccountSecrets {
  accountId: string;
  salt: string;
  passKek: Uint8Array;
  recoveryKek: Uint8Array;
  dek: Uint8Array;
  wrappedDekPass: string;
  wrappedDekRecovery: string;
  authVerifier: string;
}

/** Build secrets for a new account from mnemonic + passphrase. */
export async function createAccountSecrets(
  words: string[],
  passphrase: string,
): Promise<AccountSecrets> {
  if (passphrase.trim().length < 4) {
    throw new Error('Passphrase must be at least 4 characters.');
  }

  const seed = await mnemonicSeed(words);
  const accountId = await deriveAccountId(seed);
  const salt = randomSalt();
  const dek = randomDek();
  const passKek = await derivePassKek(passphrase, salt);
  const recoveryKek = await deriveRecoveryKek(seed);
  const wrappedDekPass = await wrapKey(passKek, dek);
  const wrappedDekRecovery = await wrapKey(recoveryKek, dek);
  const authVerifier = await deriveAuthVerifier(passKek);

  return {
    accountId,
    salt,
    passKek,
    recoveryKek,
    dek,
    wrappedDekPass,
    wrappedDekRecovery,
    authVerifier,
  };
}

/** Re-wrap an existing DEK under a new passphrase (recovery flow). */
export async function rotatePassphraseSecrets(
  words: string[],
  passphrase: string,
  dek: Uint8Array,
): Promise<AccountSecrets> {
  if (passphrase.trim().length < 4) {
    throw new Error('Passphrase must be at least 4 characters.');
  }

  const seed = await mnemonicSeed(words);
  const accountId = await deriveAccountId(seed);
  const salt = randomSalt();
  const passKek = await derivePassKek(passphrase, salt);
  const recoveryKek = await deriveRecoveryKek(seed);
  const wrappedDekPass = await wrapKey(passKek, dek);
  const wrappedDekRecovery = await wrapKey(recoveryKek, dek);
  const authVerifier = await deriveAuthVerifier(passKek);

  return {
    accountId,
    salt,
    passKek,
    recoveryKek,
    dek,
    wrappedDekPass,
    wrappedDekRecovery,
    authVerifier,
  };
}

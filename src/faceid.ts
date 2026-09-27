import type { DeviceIdentity } from './types';
import { bytesToHex, deriveBioKek, hexToBytes, unwrapKey, wrapKey } from './crypto';

const STORAGE_KEY = 'journs.faceid.v1';
const RP_NAME = 'Journs';

/** Local record of an enrolled platform passkey. Holds no secret in the clear. */
interface FaceIdRecord {
  accountId: string;
  /** Hex-encoded WebAuthn credential rawId. */
  credentialId: string;
  /** Hex-encoded PRF eval.first salt — fixed per enrollment, re-sent on every unlock. */
  salt: string;
  /** hex(nonce||cipher) — passKek wrapped under the PRF-derived bioKek. */
  wrappedPassKek: string;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);

  return b;
}

function loadRecord(): FaceIdRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<FaceIdRecord>;

    if (!parsed.accountId || !parsed.credentialId || !parsed.salt || !parsed.wrappedPassKek) {
      return null;
    }

    return parsed as FaceIdRecord;
  } catch {
    return null;
  }
}

/** Whether this browser can plausibly do a platform passkey (PRF support is only confirmed at enroll). */
export function faceIdAvailable(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window;
}

/** Whether Face ID is enrolled on this device for this account. */
export function faceIdEnrolled(accountId: string): boolean {
  return loadRecord()?.accountId === accountId;
}

/** Forget the local Face ID enrollment. Does not revoke the OS-level passkey itself. */
export function clearFaceId(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Extract the PRF `results.first` bytes from a credential's extension outputs, if present. */
function prfResultBytes(cred: PublicKeyCredential): Uint8Array | null {
  const first = cred.getClientExtensionResults().prf?.results?.first;

  return first ? new Uint8Array(first as ArrayBuffer) : null;
}

/**
 * Enroll a platform passkey (Face ID / Touch ID / Windows Hello) and wrap the
 * live session's passKek under a PRF-derived key. Requires an already-unlocked
 * session — this lets the device biometric unlock what the passphrase already
 * unlocks, never a way around the passphrase.
 */
export async function enrollFaceId(identity: DeviceIdentity, passKek: Uint8Array): Promise<void> {
  if (!faceIdAvailable()) {
    throw new Error('Platform passkeys are not supported in this browser.');
  }

  const salt = randomBytes(32);
  const created = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME },
      user: { id: randomBytes(16), name: identity.operatorId, displayName: identity.operatorId },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
      extensions: { prf: { eval: { first: salt } } },
    },
  })) as PublicKeyCredential | null;

  if (!created) {
    throw new Error('Face ID enrollment was cancelled.');
  }

  if (!created.getClientExtensionResults().prf?.enabled) {
    throw new Error('This authenticator does not support the PRF extension Face ID needs.');
  }

  // PRF output is only returned by get(), never by create() — one more
  // biometric prompt, right after the first, to actually read it.
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: created.rawId, type: 'public-key' }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: salt } } },
    },
  })) as PublicKeyCredential | null;

  const prf = assertion && prfResultBytes(assertion);

  if (!prf) {
    throw new Error('Could not read Face ID key material.');
  }

  const bioKek = await deriveBioKek(prf);
  const wrappedPassKek = await wrapKey(bioKek, passKek);
  const record: FaceIdRecord = {
    accountId: identity.accountId,
    credentialId: bytesToHex(new Uint8Array(created.rawId)),
    salt: bytesToHex(salt),
    wrappedPassKek,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

/** Unwrap passKek via Face ID for the given account. Throws on cancel, mismatch, or no enrollment. */
export async function faceIdPassKek(accountId: string): Promise<Uint8Array> {
  const record = loadRecord();

  if (!record || record.accountId !== accountId) {
    throw new Error('Face ID is not set up for this account.');
  }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: hexToBytes(record.credentialId), type: 'public-key' }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: hexToBytes(record.salt) } } },
    },
  })) as PublicKeyCredential | null;

  const prf = assertion && prfResultBytes(assertion);

  if (!prf) {
    throw new Error('Face ID did not unlock.');
  }

  const bioKek = await deriveBioKek(prf);

  try {
    return await unwrapKey(bioKek, record.wrappedPassKek);
  } catch {
    throw new Error('Face ID key is stale.');
  }
}

import { z } from 'zod';
import { journalEntrySchema, questPeriodSchema, questProgressSchema } from '../../shared/schemas.js';

export { journalEntrySchema, questPeriodSchema, questProgressSchema };

/** Hex-encoded opaque string used for salts and ciphertext fields. */
export const hexString = z.string().min(8).regex(/^[0-9a-f]+$/i);

export const registerBodySchema = z.object({
  accountId: hexString,
  salt: hexString,
  wrappedDekPass: hexString,
  wrappedDekRecovery: hexString,
  authVerifier: hexString,
});

export const loginBodySchema = z.object({
  accountId: hexString,
  authVerifier: hexString,
});

export const recoverBodySchema = z.object({
  accountId: hexString,
  salt: hexString,
  wrappedDekPass: hexString,
  wrappedDekRecovery: hexString,
  authVerifier: hexString,
});

export const encryptedEntrySchema = z.object({
  entryId: z.string().min(1),
  ciphertext: hexString,
  nonce: hexString,
  schemaVersion: z.number().int().default(1),
});

export const putEntriesBodySchema = z.object({
  entries: z.array(encryptedEntrySchema).min(1),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RecoverBody = z.infer<typeof recoverBodySchema>;
export type EncryptedEntryPayload = z.infer<typeof encryptedEntrySchema>;

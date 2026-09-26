export type { JournalEntry, QuestProgress } from '../shared/types';
import type { JournalEntry } from '../shared/types';

export type ListLayout = 'timeline' | 'stack';

/** Which static legal document is showing. */
export type LegalDoc = 'privacy' | 'terms';

export type AppView =
  | { name: 'landing' }
  | { name: 'login'; intent?: 'create' | 'recover' }
  | { name: 'list' }
  | { name: 'read'; entry: JournalEntry }
  | { name: 'compose'; existing: JournalEntry | null }
  | { name: 'profile' }
  | { name: 'transparency'; from: 'landing' | 'profile' }
  | { name: 'legal'; doc: LegalDoc; from: 'landing' | 'profile' };

/** Persisted device identity (localStorage; no DEK, passphrase, or authVerifier). */
export interface DeviceIdentity {
  accountId: string;
  operatorId: string;
  salt: string;
  wrappedDekPass: string;
  createdAt: string;
}

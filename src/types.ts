export type { JournalEntry, QuestPeriodState, QuestProgress } from '../shared/types';
import type { JournalEntry } from '../shared/types';

export type ListLayout = 'timeline' | 'stack';

export type AppView =
  | { name: 'login' }
  | { name: 'list' }
  | { name: 'read'; entry: JournalEntry }
  | { name: 'compose'; existing: JournalEntry | null }
  | { name: 'profile' }
  | { name: 'transparency' };

/** Persisted device identity (localStorage; no DEK / passphrase). */
export interface DeviceIdentity {
  accountId: string;
  operatorId: string;
  salt: string;
  wrappedDekPass: string;
  authVerifier: string;
  createdAt: string;
}

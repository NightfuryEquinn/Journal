export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  mood: number;
  energy: number;
  weather: string;
  tags: string[];
  body: string;
}

export type ListLayout = 'timeline' | 'stack';

export type AppView =
  | { name: 'login' }
  | { name: 'list' }
  | { name: 'read'; entry: JournalEntry }
  | { name: 'compose'; existing: JournalEntry | null }
  | { name: 'profile' };

/** Persisted demo operator identity (localStorage). */
export interface DeviceIdentity {
  operatorId: string;
  passphraseHash: string;
  recoveryHash: string;
  walletAddress: string | null;
  createdAt: string;
}

/** Period keys for daily (YYYY-MM-DD) and weekly (YYYY-Www) quest tracking. */
export interface QuestPeriodState {
  dayKey: string;
  weekKey: string;
  /** Quest ids completed in the current day. */
  dailyDone: string[];
  /** Quest ids completed in the current week. */
  weeklyDone: string[];
}

/** Persisted AURA / quest / special-tag progress. */
export interface QuestProgress {
  aura: number;
  claimedTags: string[];
  period: QuestPeriodState;
  lastSettledAt: string | null;
}

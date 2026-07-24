/** Shared journal entry shape (plaintext, client-side only). */
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

/** Period keys for daily (YYYY-MM-DD UTC) and weekly (YYYY-Www UTC). */
export interface QuestPeriodState {
  dayKey: string;
  weekKey: string;
  dailyDone: string[];
  weeklyDone: string[];
}

/** AURA / quest / special-tag progress (server-readable). */
export interface QuestProgress {
  aura: number;
  claimedTags: string[];
  period: QuestPeriodState;
  lastSettledAt: string | null;
}

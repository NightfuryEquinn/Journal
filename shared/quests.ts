import type { JournalEntry, QuestPeriodState, QuestProgress } from './types.js';

export type QuestKind = 'daily' | 'weekly' | 'milestone';

export interface QuestDef {
  id: string;
  kind: QuestKind;
  title: string;
  detail: string;
  aura: number;
  /** Special tag awarded on claim (milestones only). */
  tag?: string;
}

export const DAILY_QUESTS: QuestDef[] = [
  {
    id: 'daily-write',
    kind: 'daily',
    title: 'FIELD LOG',
    detail: 'Write at least 1 entry today',
    aura: 10,
  },
  {
    id: 'daily-tag',
    kind: 'daily',
    title: 'MARK THE MAP',
    detail: 'Use ≥1 tag on an entry today',
    aura: 5,
  },
];

export const WEEKLY_QUESTS: QuestDef[] = [
  {
    id: 'weekly-three',
    kind: 'weekly',
    title: 'WEEKLY CADENCE',
    detail: 'Log ≥3 entries this week',
    aura: 25,
  },
  {
    id: 'weekly-mood',
    kind: 'weekly',
    title: 'HIGH SIGNAL',
    detail: 'Log mood ≥4 at least once this week',
    aura: 15,
  },
];

export const MILESTONE_QUESTS: QuestDef[] = [
  {
    id: 'ms-pioneer',
    kind: 'milestone',
    title: 'PIONEER',
    detail: 'Write your first entry',
    aura: 0,
    tag: 'pioneer',
  },
  {
    id: 'ms-chronicler',
    kind: 'milestone',
    title: 'CHRONICLER',
    detail: 'Reach 7 entries',
    aura: 0,
    tag: 'chronicler',
  },
  {
    id: 'ms-archivist',
    kind: 'milestone',
    title: 'ARCHIVIST',
    detail: 'Reach 30 entries',
    aura: 0,
    tag: 'archivist',
  },
];

/** Format a Date as UTC YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

/** ISO-week key YYYY-Www in UTC. */
export function weekKey(d: Date = new Date()): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((tmp.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7,
    );

  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Default empty progress blob. */
export function emptyProgress(now = new Date()): QuestProgress {
  return {
    aura: 0,
    claimedTags: [],
    lastSettledAt: null,
    period: {
      dayKey: dayKey(now),
      weekKey: weekKey(now),
      dailyDone: [],
      weeklyDone: [],
    },
  };
}

/** Count of unique calendar days (UTC) that have at least one journal entry. */
export function countJournaledDays(entries: JournalEntry[]): number {
  return new Set(entries.map((e) => dayKey(new Date(e.date)))).size;
}

/**
 * Current consecutive-day writing streak, counted backward from today (UTC).
 * Not having written yet today doesn't break a streak that ran through yesterday.
 */
export function computeStreak(entries: JournalEntry[], now = new Date()): number {
  const days = new Set(entries.map((e) => dayKey(new Date(e.date))));
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (!days.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;

  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

/** True if entry date falls on the given UTC day key. */
function entryOnDay(entry: JournalEntry, dk: string): boolean {
  return dayKey(new Date(entry.date)) === dk;
}

/** True if entry date falls in the given UTC ISO week key. */
function entryInWeek(entry: JournalEntry, wk: string): boolean {
  return weekKey(new Date(entry.date)) === wk;
}

/** Whether a quest's completion condition is met from journal entries. */
export function isQuestSatisfied(
  quest: QuestDef,
  entries: JournalEntry[],
  period: QuestPeriodState,
): boolean {
  const today = entries.filter((e) => entryOnDay(e, period.dayKey));
  const thisWeek = entries.filter((e) => entryInWeek(e, period.weekKey));

  switch (quest.id) {
    case 'daily-write':
      return today.length >= 1;
    case 'daily-tag':
      return today.some((e) => e.tags.length > 0);
    case 'weekly-three':
      return thisWeek.length >= 3;
    case 'weekly-mood':
      return thisWeek.some((e) => e.mood >= 4);
    case 'ms-pioneer':
      return entries.length >= 1;
    case 'ms-chronicler':
      return entries.length >= 7;
    case 'ms-archivist':
      return entries.length >= 30;
    default:
      return false;
  }
}

/** Progress fraction for display bars. */
export function questProgressRatio(
  quest: QuestDef,
  entries: JournalEntry[],
  period: QuestPeriodState,
): { current: number; target: number } {
  const today = entries.filter((e) => entryOnDay(e, period.dayKey));
  const thisWeek = entries.filter((e) => entryInWeek(e, period.weekKey));

  switch (quest.id) {
    case 'daily-write':
      return { current: Math.min(today.length, 1), target: 1 };
    case 'daily-tag':
      return { current: today.some((e) => e.tags.length > 0) ? 1 : 0, target: 1 };
    case 'weekly-three':
      return { current: Math.min(thisWeek.length, 3), target: 3 };
    case 'weekly-mood':
      return { current: thisWeek.some((e) => e.mood >= 4) ? 1 : 0, target: 1 };
    case 'ms-pioneer':
      return { current: Math.min(entries.length, 1), target: 1 };
    case 'ms-chronicler':
      return { current: Math.min(entries.length, 7), target: 7 };
    case 'ms-archivist':
      return { current: Math.min(entries.length, 30), target: 30 };
    default:
      return { current: 0, target: 1 };
  }
}

/**
 * Roll day/week windows and deduct AURA for missed prior-period quests (floor 0).
 * Uses UTC period keys so cron-job.org and clients agree.
 */
export function settleAura(progress: QuestProgress, now = new Date()): QuestProgress {
  const dk = dayKey(now);
  const wk = weekKey(now);
  let aura = progress.aura;
  let dailyDone = [...progress.period.dailyDone];
  let weeklyDone = [...progress.period.weeklyDone];
  let periodDay = progress.period.dayKey;
  let periodWeek = progress.period.weekKey;

  if (periodDay !== dk) {
    const missed = DAILY_QUESTS.filter((q) => !dailyDone.includes(q.id));
    const penalty = missed.reduce((s, q) => s + q.aura, 0);
    aura = Math.max(0, aura - penalty);
    dailyDone = [];
    periodDay = dk;
  }

  if (periodWeek !== wk) {
    const missed = WEEKLY_QUESTS.filter((q) => !weeklyDone.includes(q.id));
    const penalty = missed.reduce((s, q) => s + q.aura, 0);
    aura = Math.max(0, aura - penalty);
    weeklyDone = [];
    periodWeek = wk;
  }

  return {
    ...progress,
    aura,
    period: {
      dayKey: periodDay,
      weekKey: periodWeek,
      dailyDone,
      weeklyDone,
    },
    lastSettledAt: now.toISOString(),
  };
}

/** Claim a completed daily/weekly quest and grant AURA once. */
export function claimTimedQuest(
  progress: QuestProgress,
  quest: QuestDef,
  entries: JournalEntry[],
): QuestProgress {
  if (quest.kind === 'milestone') {
    return progress;
  }

  const settled = settleAura(progress);
  const doneList = quest.kind === 'daily' ? settled.period.dailyDone : settled.period.weeklyDone;

  if (doneList.includes(quest.id)) {
    return settled;
  }

  if (!isQuestSatisfied(quest, entries, settled.period)) {
    return settled;
  }

  const nextDone = [...doneList, quest.id];
  const period =
    quest.kind === 'daily'
      ? { ...settled.period, dailyDone: nextDone }
      : { ...settled.period, weeklyDone: nextDone };

  return {
    ...settled,
    aura: settled.aura + quest.aura,
    period,
  };
}

/** Claim a milestone special tag when requirements are met. */
export function claimMilestoneTag(
  progress: QuestProgress,
  quest: QuestDef,
  entries: JournalEntry[],
): QuestProgress {
  if (quest.kind !== 'milestone' || !quest.tag) {
    return progress;
  }

  if (progress.claimedTags.includes(quest.tag)) {
    return progress;
  }

  if (!isQuestSatisfied(quest, entries, progress.period)) {
    return progress;
  }

  return {
    ...progress,
    claimedTags: [...progress.claimedTags, quest.tag],
  };
}

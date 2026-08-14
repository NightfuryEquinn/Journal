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
  /**
   * First UTC day this timed quest can be missed.
   * Closed periods before this date are not penalized (catalog ship).
   */
  sinceDay?: string;
}

/** Composer weather labels; first segment before ` · ` is what we match. */
export const WEATHER_TYPES = [
  'CLEAR',
  'OVERCAST',
  'WINDY',
  'LIGHT RAIN',
  'HEAVY RAIN',
  'FOG',
  'SNOW',
] as const;

const NEW_SINCE = '2026-08-14';

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
  {
    id: 'daily-tags-3',
    kind: 'daily',
    title: 'INDEX THE LINE',
    detail: 'Use ≥3 tags on one entry today',
    aura: 5,
    sinceDay: NEW_SINCE,
  },
  {
    id: 'daily-long',
    kind: 'daily',
    title: 'LONG TRANSMISSION',
    detail: 'One entry today with ≥100 words',
    aura: 5,
    sinceDay: NEW_SINCE,
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
  {
    id: 'weekly-days',
    kind: 'weekly',
    title: 'FOUR-DAY WATCH',
    detail: 'Log on ≥4 distinct UTC days this week',
    aura: 15,
    sinceDay: NEW_SINCE,
  },
  {
    id: 'weekly-energy',
    kind: 'weekly',
    title: 'CHARGE THE CELLS',
    detail: 'Log energy ≥4 at least once this week',
    aura: 10,
    sinceDay: NEW_SINCE,
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
  {
    id: 'ms-historian',
    kind: 'milestone',
    title: 'HISTORIAN',
    detail: 'Reach 50 entries',
    aura: 0,
    tag: 'historian',
  },
  {
    id: 'ms-scribe',
    kind: 'milestone',
    title: 'SCRIBE',
    detail: 'Reach 100 entries',
    aura: 0,
    tag: 'scribe',
  },
  {
    id: 'ms-cartographer',
    kind: 'milestone',
    title: 'CARTOGRAPHER',
    detail: '10 unique tags lifetime',
    aura: 0,
    tag: 'cartographer',
  },
  {
    id: 'ms-lexicon',
    kind: 'milestone',
    title: 'LEXICON',
    detail: '25 unique tags lifetime',
    aura: 0,
    tag: 'lexicon',
  },
  {
    id: 'ms-sentinel',
    kind: 'milestone',
    title: 'SENTINEL',
    detail: '7-day writing streak',
    aura: 0,
    tag: 'sentinel',
  },
  {
    id: 'ms-garrison',
    kind: 'milestone',
    title: 'GARRISON',
    detail: '30-day writing streak',
    aura: 0,
    tag: 'garrison',
  },
  {
    id: 'ms-marathon',
    kind: 'milestone',
    title: 'MARATHON',
    detail: '90-day writing streak',
    aura: 0,
    tag: 'marathon',
  },
  {
    id: 'ms-treatise',
    kind: 'milestone',
    title: 'TREATISE',
    detail: 'One entry ≥500 words',
    aura: 0,
    tag: 'treatise',
  },
  {
    id: 'ms-weathered',
    kind: 'milestone',
    title: 'WEATHERED',
    detail: 'Log all 7 weather types',
    aura: 0,
    tag: 'weathered',
  },
  {
    id: 'ms-spectrum',
    kind: 'milestone',
    title: 'SPECTRUM',
    detail: 'Log mood 1 and mood 5 at least once',
    aura: 0,
    tag: 'spectrum',
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

/** Whitespace-separated word count of a journal body. */
export function wordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

/** Unique lowercase trimmed tags across entries (empties dropped). */
export function uniqueTags(entries: JournalEntry[]): string[] {
  const tags = new Set<string>();

  for (const entry of entries) {
    for (const raw of entry.tags) {
      const tag = raw.trim().toLowerCase();

      if (tag) {
        tags.add(tag);
      }
    }
  }

  return [...tags];
}

/** Unique trimmed lowercase tags on a single entry. */
function entryTagCount(entry: JournalEntry): number {
  return uniqueTags([entry]).length;
}

/** Canonical weather label from a stored string (first segment before ` · `). */
export function weatherLabel(raw: string): string {
  return raw.split(' · ')[0].trim().toUpperCase();
}

/** Distinct known weather types logged in the archive. */
export function uniqueWeathers(entries: JournalEntry[]): string[] {
  const known = new Set<string>(WEATHER_TYPES);
  const seen = new Set<string>();

  for (const entry of entries) {
    const label = weatherLabel(entry.weather);

    if (known.has(label)) {
      seen.add(label);
    }
  }

  return [...seen];
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

/** Longest consecutive UTC-day run anywhere in the archive. */
export function maxStreak(entries: JournalEntry[]): number {
  const days = [...new Set(entries.map((e) => dayKey(new Date(e.date))))].sort();

  if (days.length === 0) {
    return 0;
  }

  let best = 1;
  let run = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`);
    const cur = new Date(`${days[i]}T00:00:00Z`);
    const diff = (cur.getTime() - prev.getTime()) / 86_400_000;

    if (diff === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  return best;
}

/** True if entry date falls on the given UTC day key. */
function entryOnDay(entry: JournalEntry, dk: string): boolean {
  return dayKey(new Date(entry.date)) === dk;
}

/** True if entry date falls in the given UTC ISO week key. */
function entryInWeek(entry: JournalEntry, wk: string): boolean {
  return weekKey(new Date(entry.date)) === wk;
}

/** SPECTRUM progress: 1 if mood 1 logged, +1 if mood 5 logged. */
function spectrumScore(entries: JournalEntry[]): number {
  const moods = new Set(entries.map((e) => e.mood));

  return (moods.has(1) ? 1 : 0) + (moods.has(5) ? 1 : 0);
}

/** Whether a quest's completion condition is met from journal entries. */
export function isQuestSatisfied(
  quest: QuestDef,
  entries: JournalEntry[],
  period: QuestPeriodState,
): boolean {
  const ratio = questProgressRatio(quest, entries, period);

  return ratio.current >= ratio.target;
}

/** Progress fraction for display bars. */
export function questProgressRatio(
  quest: QuestDef,
  entries: JournalEntry[],
  period: QuestPeriodState,
): { current: number; target: number } {
  const today = entries.filter((e) => entryOnDay(e, period.dayKey));
  const thisWeek = entries.filter((e) => entryInWeek(e, period.weekKey));
  const weekDays = new Set(thisWeek.map((e) => dayKey(new Date(e.date)))).size;
  const longToday = today.reduce((m, e) => Math.max(m, wordCount(e.body)), 0);
  const longEver = entries.reduce((m, e) => Math.max(m, wordCount(e.body)), 0);
  const tagsEver = uniqueTags(entries).length;
  const weathers = uniqueWeathers(entries).length;
  const streak = maxStreak(entries);

  switch (quest.id) {
    case 'daily-write':
      return { current: Math.min(today.length, 1), target: 1 };
    case 'daily-tag':
      return { current: today.some((e) => entryTagCount(e) >= 1) ? 1 : 0, target: 1 };
    case 'daily-tags-3':
      return { current: today.some((e) => entryTagCount(e) >= 3) ? 1 : 0, target: 1 };
    case 'daily-long':
      return { current: Math.min(longToday, 100), target: 100 };
    case 'weekly-three':
      return { current: Math.min(thisWeek.length, 3), target: 3 };
    case 'weekly-mood':
      return { current: thisWeek.some((e) => e.mood >= 4) ? 1 : 0, target: 1 };
    case 'weekly-days':
      return { current: Math.min(weekDays, 4), target: 4 };
    case 'weekly-energy':
      return { current: thisWeek.some((e) => e.energy >= 4) ? 1 : 0, target: 1 };
    case 'ms-pioneer':
      return { current: Math.min(entries.length, 1), target: 1 };
    case 'ms-chronicler':
      return { current: Math.min(entries.length, 7), target: 7 };
    case 'ms-archivist':
      return { current: Math.min(entries.length, 30), target: 30 };
    case 'ms-historian':
      return { current: Math.min(entries.length, 50), target: 50 };
    case 'ms-scribe':
      return { current: Math.min(entries.length, 100), target: 100 };
    case 'ms-cartographer':
      return { current: Math.min(tagsEver, 10), target: 10 };
    case 'ms-lexicon':
      return { current: Math.min(tagsEver, 25), target: 25 };
    case 'ms-sentinel':
      return { current: Math.min(streak, 7), target: 7 };
    case 'ms-garrison':
      return { current: Math.min(streak, 30), target: 30 };
    case 'ms-marathon':
      return { current: Math.min(streak, 90), target: 90 };
    case 'ms-treatise':
      return { current: Math.min(longEver, 500), target: 500 };
    case 'ms-weathered':
      return { current: Math.min(weathers, WEATHER_TYPES.length), target: WEATHER_TYPES.length };
    case 'ms-spectrum':
      return { current: spectrumScore(entries), target: 2 };
    default:
      return { current: 0, target: 1 };
  }
}

/** True when a timed quest can be missed for the closed daily period. */
function dailyPenalized(quest: QuestDef, closedDay: string): boolean {
  return !quest.sinceDay || quest.sinceDay <= closedDay;
}

/** True when a timed quest can be missed for the closed weekly period. */
function weeklyPenalized(quest: QuestDef, closedWeek: string): boolean {
  if (!quest.sinceDay) {
    return true;
  }

  return weekKey(new Date(`${quest.sinceDay}T00:00:00Z`)) <= closedWeek;
}

/**
 * Roll day/week windows and deduct AURA for missed prior-period quests (floor 0).
 * Uses UTC period keys so cron-job.org and clients agree.
 * Quests with sinceDay after the closed period are skipped (catalog ship).
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
    const missed = DAILY_QUESTS.filter(
      (q) => !dailyDone.includes(q.id) && dailyPenalized(q, periodDay),
    );
    const penalty = missed.reduce((s, q) => s + q.aura, 0);
    aura = Math.max(0, aura - penalty);
    dailyDone = [];
    periodDay = dk;
  }

  if (periodWeek !== wk) {
    const missed = WEEKLY_QUESTS.filter(
      (q) => !weeklyDone.includes(q.id) && weeklyPenalized(q, periodWeek),
    );
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

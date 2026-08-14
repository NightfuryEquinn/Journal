/**
 * Self-check for quest catalog logic in shared/quests.ts.
 * Run: `bun run check:quests`
 */
import assert from 'node:assert/strict';
import type { JournalEntry, QuestProgress } from '../shared/types.js';
import {
  DAILY_QUESTS,
  MILESTONE_QUESTS,
  WEEKLY_QUESTS,
  WEATHER_TYPES,
  computeStreak,
  emptyProgress,
  isQuestSatisfied,
  maxStreak,
  questProgressRatio,
  settleAura,
  uniqueTags,
  uniqueWeathers,
  wordCount,
  type QuestDef,
} from '../shared/quests.js';

const WORDS_100 = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ');
const WORDS_500 = Array.from({ length: 500 }, (_, i) => `w${i}`).join(' ');

/** Build a journal entry with overrides. */
function entry(partial: Partial<JournalEntry> & { date: string }): JournalEntry {
  return {
    id: partial.id ?? `e-${partial.date}`,
    title: partial.title ?? 'log',
    mood: partial.mood ?? 3,
    energy: partial.energy ?? 3,
    weather: partial.weather ?? 'CLEAR',
    tags: partial.tags ?? [],
    body: partial.body ?? 'hello',
    date: partial.date,
  };
}

/** Look up a catalog quest by id. */
function q(id: string): QuestDef {
  const found = [...DAILY_QUESTS, ...WEEKLY_QUESTS, ...MILESTONE_QUESTS].find((x) => x.id === id);

  assert.ok(found, `missing quest ${id}`);

  return found!;
}

const period = emptyProgress(new Date('2026-08-14T12:00:00Z')).period;

assert.equal(wordCount('  one two  three '), 3);
assert.equal(wordCount(''), 0);
assert.equal(uniqueTags([entry({ date: '2026-08-14T00:00:00Z', tags: [' A ', 'a', 'B', ''] })]).length, 2);

const todayTagged = [
  entry({
    date: '2026-08-14T10:00:00Z',
    tags: ['recon', 'self', 'field'],
    body: WORDS_100,
  }),
];

assert.equal(isQuestSatisfied(q('daily-write'), todayTagged, period), true);
assert.equal(isQuestSatisfied(q('daily-tag'), todayTagged, period), true);
assert.equal(isQuestSatisfied(q('daily-tags-3'), todayTagged, period), true);
assert.equal(isQuestSatisfied(q('daily-long'), todayTagged, period), true);
assert.equal(isQuestSatisfied(q('daily-tags-3'), [entry({ date: '2026-08-14T10:00:00Z', tags: ['a', 'b'] })], period), false);
assert.equal(isQuestSatisfied(q('daily-long'), [entry({ date: '2026-08-14T10:00:00Z', body: 'short' })], period), false);

const weekEntries = [
  entry({ date: '2026-08-10T12:00:00Z', mood: 4, energy: 2 }),
  entry({ date: '2026-08-11T12:00:00Z', energy: 5 }),
  entry({ date: '2026-08-12T12:00:00Z' }),
  entry({ date: '2026-08-13T12:00:00Z' }),
];

assert.equal(isQuestSatisfied(q('weekly-three'), weekEntries, period), true);
assert.equal(isQuestSatisfied(q('weekly-mood'), weekEntries, period), true);
assert.equal(isQuestSatisfied(q('weekly-days'), weekEntries, period), true);
assert.equal(isQuestSatisfied(q('weekly-energy'), weekEntries, period), true);
assert.equal(isQuestSatisfied(q('weekly-days'), weekEntries.slice(0, 3), period), false);

const unknown: QuestDef = {
  id: 'daily-nope',
  kind: 'daily',
  title: 'NOPE',
  detail: 'missing',
  aura: 1,
};

assert.equal(isQuestSatisfied(unknown, todayTagged, period), false);
assert.deepEqual(questProgressRatio(unknown, todayTagged, period), { current: 0, target: 1 });

const hundred = Array.from({ length: 100 }, (_, i) =>
  entry({
    id: `e-${i}`,
    date: `2026-01-01T00:00:00Z`,
    tags: i < 25 ? [`t${i}`] : [],
    mood: i === 0 ? 1 : i === 1 ? 5 : 3,
    weather: WEATHER_TYPES[i % WEATHER_TYPES.length],
    body: i === 2 ? WORDS_500 : 'x',
  }),
);

assert.equal(isQuestSatisfied(q('ms-scribe'), hundred, period), true);
assert.equal(isQuestSatisfied(q('ms-historian'), hundred, period), true);
assert.equal(isQuestSatisfied(q('ms-lexicon'), hundred, period), true);
assert.equal(isQuestSatisfied(q('ms-cartographer'), hundred, period), true);
assert.equal(isQuestSatisfied(q('ms-treatise'), hundred, period), true);
assert.equal(isQuestSatisfied(q('ms-weathered'), hundred, period), true);
assert.equal(uniqueWeathers(hundred).length, WEATHER_TYPES.length);
assert.equal(isQuestSatisfied(q('ms-spectrum'), hundred, period), true);
assert.equal(isQuestSatisfied(q('ms-scribe'), hundred.slice(0, 99), period), false);

const streakDays = Array.from({ length: 30 }, (_, i) => {
  const d = String(i + 1).padStart(2, '0');

  return entry({ date: `2026-06-${d}T12:00:00Z` });
});

assert.equal(maxStreak(streakDays), 30);
assert.equal(computeStreak(streakDays, new Date('2026-08-14T12:00:00Z')), 0);
assert.equal(isQuestSatisfied(q('ms-garrison'), streakDays, period), true);
assert.equal(isQuestSatisfied(q('ms-sentinel'), streakDays, period), true);
assert.equal(isQuestSatisfied(q('ms-marathon'), streakDays, period), false);

const beforeShip: QuestProgress = {
  aura: 100,
  claimedTags: [],
  lastSettledAt: null,
  period: {
    dayKey: '2026-08-13',
    weekKey: '2026-W32',
    dailyDone: [],
    weeklyDone: [],
  },
};

const settledBefore = settleAura(beforeShip, new Date('2026-08-14T12:00:00Z'));
assert.equal(settledBefore.aura, 100 - 10 - 5 - 25 - 15);
assert.equal(settledBefore.period.dayKey, '2026-08-14');
assert.equal(settledBefore.period.dailyDone.length, 0);

const afterShip: QuestProgress = {
  aura: 100,
  claimedTags: [],
  lastSettledAt: null,
  period: {
    dayKey: '2026-08-14',
    weekKey: '2026-W33',
    dailyDone: [],
    weeklyDone: [],
  },
};

const settledAfter = settleAura(afterShip, new Date('2026-08-15T12:00:00Z'));
assert.equal(settledAfter.aura, 100 - 10 - 5 - 5 - 5);

console.log('quest-check ok');

import { z } from 'zod';

/** Plaintext journal entry (client decrypt / import-export). */
export const journalEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  title: z.string(),
  mood: z.number().min(1).max(5),
  energy: z.number().min(1).max(5),
  weather: z.string(),
  tags: z.array(z.string()),
  body: z.string(),
});

export const questPeriodSchema = z.object({
  dayKey: z.string(),
  weekKey: z.string(),
  dailyDone: z.array(z.string()),
  weeklyDone: z.array(z.string()),
});

export const questProgressSchema = z.object({
  aura: z.number().int().min(0),
  claimedTags: z.array(z.string()),
  period: questPeriodSchema,
  lastSettledAt: z.string().nullable(),
});

/**
 * Client quest helpers — re-export shared UTC settle/claim logic.
 * Local progress persistence is deprecated; server is source of truth.
 */
export {
  DAILY_QUESTS,
  WEEKLY_QUESTS,
  MILESTONE_QUESTS,
  WEATHER_TYPES,
  dayKey,
  weekKey,
  wordCount,
  uniqueTags,
  uniqueWeathers,
  countJournaledDays,
  computeStreak,
  maxStreak,
  emptyProgress,
  isQuestSatisfied,
  questProgressRatio,
  settleAura,
  claimTimedQuest,
  claimMilestoneTag,
  type QuestDef,
  type QuestKind,
} from '../shared/quests';

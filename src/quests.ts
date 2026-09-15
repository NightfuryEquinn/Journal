/**
 * Client quest helpers — re-export shared UTC settle/claim logic.
 * Local progress persistence is deprecated; server is source of truth.
 */
export {
  DAILY_QUESTS,
  WEEKLY_QUESTS,
  MILESTONE_QUESTS,
  countJournaledDays,
  computeStreak,
  emptyProgress,
  isQuestSatisfied,
  questProgressRatio,
  settleAura,
  claimTimedQuest,
  claimMilestoneTag,
  type QuestDef,
} from '../shared/quests';

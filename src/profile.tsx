import { useMemo } from 'react';
import type { DeviceIdentity, JournalEntry, QuestProgress } from './types';
import { SoundManager, Bracket, Panel, Btn, fmtDate, fmtStamp } from './hud';
import {
  DAILY_QUESTS,
  MILESTONE_QUESTS,
  WEEKLY_QUESTS,
  claimMilestoneTag,
  claimTimedQuest,
  isQuestSatisfied,
  questProgressRatio,
  type QuestDef,
} from './quests';

const CHIP =
  'border px-[7px] py-0.5 font-mono text-[9.5px] tracking-[0.1em] text-accent bg-accent-soft border-[color-mix(in_oklab,var(--accent)_35%,transparent)]';

interface ProfileScreenProps {
  identity: DeviceIdentity;
  entries: JournalEntry[];
  progress: QuestProgress;
  onBack: () => void;
  onProgressChange: (progress: QuestProgress) => void;
}

/** Operator profile: AURA, quests, and special tags. */
export function ProfileScreen({
  identity,
  entries,
  progress,
  onBack,
  onProgressChange,
}: ProfileScreenProps) {
  /** Claim a daily/weekly quest for AURA. */
  const onClaimTimed = (quest: QuestDef) => {
    const next = claimTimedQuest(progress, quest, entries);
    onProgressChange(next);
    SoundManager.confirm();
  };

  /** Claim a milestone special tag. */
  const onClaimTag = (quest: QuestDef) => {
    const next = claimMilestoneTag(progress, quest, entries);
    onProgressChange(next);
    SoundManager.confirm();
  };

  const created = useMemo(() => new Date(identity.createdAt), [identity.createdAt]);

  return (
    <div className="mx-auto max-w-350 px-4 pt-4 pb-6 max-phone:px-3 laptop:px-7 laptop:pt-5 laptop:pb-7">
      <div className="mb-5.5 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <Btn variant="ghost" onClick={onBack}>
            ← ARCHIVE
          </Btn>
          <span className="font-mono text-[11px] tracking-[0.14em] text-fg-mute">
            / PROFILE / {identity.operatorId}
          </span>
        </div>
        <div className="font-mono text-[10px] tracking-[0.16em] text-fg-mute">
          AURA SETTLED · {progress.lastSettledAt ? fmtStamp(new Date(progress.lastSettledAt)) : '—'}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 tablet:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] tablet:gap-5.5 laptop:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-5">
          <Bracket>
            <Panel title="OPERATOR" meta="LOCAL DEMO">
              <div className="grid gap-2.5 font-mono text-[11px]">
                <Row label="CALLSIGN" value={identity.operatorId} accent />
                <Row label="CREATED" value={fmtDate(created)} />
                <Row label="RECOVERY" value="CONFIRMED" accent />
                <Row
                  label="ENTRIES"
                  value={String(entries.length).padStart(4, '0')}
                />
              </div>
            </Panel>
          </Bracket>

          <Bracket>
            <Panel title="AURA" meta="TEMPORARY">
              <div className="mb-2 font-display text-4xl font-semibold tracking-[0.12em] text-accent">
                {progress.aura}
              </div>
              <p className="font-mono text-[10px] leading-[1.6] tracking-[0.04em] text-fg-mute">
                // accrues from daily / weekly quests · deducts on missed periods · floor 0
              </p>
            </Panel>
          </Bracket>

          <Bracket>
            <Panel title="SPECIAL TAGS" meta={`${progress.claimedTags.length} claimed`}>
              {progress.claimedTags.length === 0 ? (
                <p className="font-mono text-[11px] text-fg-mute">// none claimed yet</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {progress.claimedTags.map((t) => (
                    <span key={t} className={CHIP}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Panel>
          </Bracket>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <QuestPanel
            title="DAILY QUESTS"
            meta={progress.period.dayKey}
            quests={DAILY_QUESTS}
            entries={entries}
            progress={progress}
            doneIds={progress.period.dailyDone}
            onClaim={onClaimTimed}
          />
          <QuestPanel
            title="WEEKLY QUESTS"
            meta={progress.period.weekKey}
            quests={WEEKLY_QUESTS}
            entries={entries}
            progress={progress}
            doneIds={progress.period.weeklyDone}
            onClaim={onClaimTimed}
          />
          <QuestPanel
            title="MILESTONES"
            meta="SPECIAL TAGS"
            quests={MILESTONE_QUESTS}
            entries={entries}
            progress={progress}
            doneIds={progress.claimedTags}
            onClaim={onClaimTag}
            milestone
          />
        </div>
      </div>
    </div>
  );
}

/** Label / value telemetry row. */
function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="tracking-[0.16em] text-fg-mute">{label}</span>
      <span className={`truncate ${accent ? 'text-accent' : 'text-fg'}`}>{value}</span>
    </div>
  );
}

/** Shared quest list panel for daily / weekly / milestones. */
function QuestPanel({
  title,
  meta,
  quests,
  entries,
  progress,
  doneIds,
  onClaim,
  milestone,
}: {
  title: string;
  meta: string;
  quests: QuestDef[];
  entries: JournalEntry[];
  progress: QuestProgress;
  doneIds: string[];
  onClaim: (quest: QuestDef) => void;
  milestone?: boolean;
}) {
  return (
    <Bracket>
      <Panel title={title} meta={meta}>
        <ul className="flex flex-col gap-3">
          {quests.map((q) => {
            const satisfied = isQuestSatisfied(q, entries, progress.period);
            const claimed = milestone
              ? Boolean(q.tag && progress.claimedTags.includes(q.tag))
              : doneIds.includes(q.id);
            const ratio = questProgressRatio(q, entries, progress.period);
            const pct = Math.round((ratio.current / Math.max(1, ratio.target)) * 100);

            return (
              <li
                key={q.id}
                className="border border-line bg-black/20 px-3 py-3 max-phone:px-2.5"
              >
                <div className="mb-2 flex flex-col gap-2 phone:flex-row phone:items-start phone:justify-between">
                  <div className="min-w-0">
                    <div className="font-display text-[11px] font-semibold tracking-[0.18em] text-fg">
                      {q.title}
                      {q.tag && (
                        <span className="ml-2 font-mono text-[10px] tracking-[0.08em] text-accent">
                          #{q.tag}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-fg-dim">{q.detail}</div>
                  </div>
                  <div className="shrink-0 font-mono text-[10px] tracking-[0.12em] text-fg-mute">
                    {milestone
                      ? claimed
                        ? 'CLAIMED'
                        : 'TAG'
                      : claimed
                        ? `+${q.aura} AURA`
                        : `+${q.aura} AURA`}
                  </div>
                </div>
                <div className="mb-2.5 h-1 w-full bg-line-strong">
                  <div
                    className="h-full bg-accent shadow-[0_0_8px_var(--accent)] transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-fg-mute">
                    {ratio.current}/{ratio.target}
                    {claimed ? ' · DONE' : satisfied ? ' · READY' : ' · IN PROGRESS'}
                  </span>
                  <Btn
                    variant={claimed ? 'ghost' : 'primary'}
                    disabled={claimed || !satisfied}
                    onClick={() => onClaim(q)}
                    className="max-tablet:min-h-11"
                  >
                    {claimed ? 'CLAIMED' : milestone ? 'CLAIM TAG' : 'CLAIM AURA'}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </Bracket>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BellIcon,
  BellSlashIcon,
  CaretLeftIcon,
  DownloadSimpleIcon,
  FlameIcon,
  SparkleIcon,
  TreeStructureIcon,
  TrophyIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import type { DeviceIdentity, JournalEntry, QuestProgress } from './types';
import { CHIP, Bracket, Panel, Btn, PAGE } from './hud';
import { SoundManager } from './sound';
import { fmtDate, fmtStamp } from './format';
import {
  DAILY_QUESTS,
  MILESTONE_QUESTS,
  WEEKLY_QUESTS,
  claimMilestoneTag,
  claimTimedQuest,
  computeStreak,
  isQuestSatisfied,
  questProgressRatio,
  type QuestDef,
} from './quests';
import { journalEntrySchema } from '../shared/schemas';
import { REMINDER_HOURS } from '../shared/push';
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushConfigured,
  pushPermission,
  pushSupported,
} from './push';
import { z } from 'zod';
import { useEntrance } from './motion';

const exportSchema = z.array(journalEntrySchema);

interface ProfileScreenProps {
  identity: DeviceIdentity;
  /** Session token, or null when the session has lapsed. */
  token: string | null;
  entries: JournalEntry[];
  progress: QuestProgress;
  onBack: () => void;
  onProgressChange: (progress: QuestProgress) => void | Promise<void>;
  onImport: (entries: JournalEntry[]) => void | Promise<void>;
  onOpenTransparency: () => void;
}

/** Operator profile: AURA, quests, import/export, transparency. */
export function ProfileScreen({
  identity,
  token,
  entries,
  progress,
  onBack,
  onProgressChange,
  onImport,
  onOpenTransparency,
}: ProfileScreenProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ioStatus, setIoStatus] = useState<string | null>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  useEntrance(scopeRef);

  /** Claim a daily/weekly quest for AURA. */
  const onClaimTimed = (quest: QuestDef) => {
    const next = claimTimedQuest(progress, quest, entries);
    void onProgressChange(next);
    SoundManager.confirm();
  };

  /** Claim a milestone special tag. */
  const onClaimTag = (quest: QuestDef) => {
    const next = claimMilestoneTag(progress, quest, entries);
    void onProgressChange(next);
    SoundManager.confirm();
  };

  /** Download decrypted journal JSON backup. */
  const exportJson = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journs-export-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    SoundManager.confirm();
    setIoStatus(`// exported ${entries.length} entries`);
  };

  /** Import plaintext JSON and merge via parent sync. */
  const onFile = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = exportSchema.safeParse(JSON.parse(text));

      if (!parsed.success) {
        setIoStatus('// import failed · invalid journal JSON');
        SoundManager.deny();

        return;
      }

      await onImport(parsed.data);
      SoundManager.confirm();
      setIoStatus(`// imported ${parsed.data.length} entries`);
    } catch {
      setIoStatus('// import failed · could not parse file');
      SoundManager.deny();
    }
  };

  const created = useMemo(() => new Date(identity.createdAt), [identity.createdAt]);
  const streak = useMemo(() => computeStreak(entries), [entries]);

  return (
    <div ref={scopeRef} className={PAGE}>
      <div
        data-reveal
        className="mb-5.5 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <Btn variant="ghost" onClick={onBack}>
            <CaretLeftIcon className="size-3.5" weight="bold" />
            ARCHIVE
          </Btn>
          <span className="font-mono text-meta tracking-[0.14em] text-fg-mute">
            / PROFILE / {identity.operatorId}
          </span>
        </div>
        <div className="font-mono text-micro tracking-[0.16em] text-fg-mute">
          AURA SETTLED · {progress.lastSettledAt ? fmtStamp(new Date(progress.lastSettledAt)) : '—'}
        </div>
      </div>

      <div
        data-reveal
        className="mb-5.5 grid grid-cols-1 gap-3.5 tablet:grid-cols-2 tablet:grid-flow-dense laptop:grid-cols-4"
      >
        <Bracket className="tablet:col-span-2 laptop:col-span-2">
          <Panel title="OPERATOR" meta="E2EE SESSION">
            <div className="grid gap-2.5 font-mono text-meta">
              <Row label="CALLSIGN" value={identity.operatorId} accent />
              <Row label="ACCOUNT" value={`${identity.accountId.slice(0, 12)}…`} />
              <Row label="CREATED" value={fmtDate(created)} />
              <Row label="RECOVERY" value="CONFIRMED" accent />
              <Row label="ENTRIES" value={String(entries.length).padStart(4, '0')} />
            </div>
          </Panel>
        </Bracket>

        <Bracket>
          <Panel title="STREAK" meta="DAYS">
            <div className="mb-2 font-headline text-4xl font-semibold tracking-[0.12em] text-accent">
              {streak}
            </div>
            <p className="font-mono text-micro leading-[1.6] tracking-[0.04em] text-fg-mute">
              // consecutive days with a journal entry
            </p>
          </Panel>
        </Bracket>

        <Bracket>
          <Panel title="AURA" meta="SCORE">
            <div className="mb-2 font-headline text-4xl font-semibold tracking-[0.12em] text-accent">
              {progress.aura}
            </div>
            <p className="font-mono text-micro leading-[1.6] tracking-[0.04em] text-fg-mute">
              // accrues from quests · deducts on missed periods
            </p>
          </Panel>
        </Bracket>

        <Bracket className="tablet:col-span-2 laptop:col-span-2">
          <Panel title="SPECIAL TAGS" meta={`${progress.claimedTags.length} claimed`}>
            {progress.claimedTags.length === 0 ? (
              <p className="font-mono text-meta text-fg-mute">// none claimed yet</p>
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

        <Bracket>
          <Panel title="DATA" meta="LOCAL · CLOUD">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-2">
                <Btn variant="ghost" onClick={exportJson}>
                  <DownloadSimpleIcon className="size-3.5" weight="bold" />
                  EXPORT
                </Btn>
                <Btn variant="ghost" onClick={() => fileRef.current?.click()}>
                  <UploadSimpleIcon className="size-3.5" weight="bold" />
                  IMPORT
                </Btn>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Btn variant="ghost" onClick={onOpenTransparency} className="w-full">
                <TreeStructureIcon className="size-3.5" weight="bold" />
                TRANSPARENCY
              </Btn>
              {ioStatus && (
                <p className="font-mono text-micro tracking-[0.04em] text-fg-mute">{ioStatus}</p>
              )}
            </div>
          </Panel>
        </Bracket>

        <NotificationsPanel token={token} />
      </div>

      <div data-reveal className="grid grid-cols-1 items-start gap-5 laptop:grid-cols-2">
        <QuestPanel
          title="DAILY QUESTS"
          icon={<SparkleIcon className="size-3.5 text-accent" weight="fill" />}
          meta={progress.period.dayKey}
          quests={DAILY_QUESTS}
          entries={entries}
          progress={progress}
          doneIds={progress.period.dailyDone}
          onClaim={onClaimTimed}
        />
        <QuestPanel
          title="WEEKLY QUESTS"
          icon={<TrophyIcon className="size-3.5 text-accent" weight="fill" />}
          meta={progress.period.weekKey}
          quests={WEEKLY_QUESTS}
          entries={entries}
          progress={progress}
          doneIds={progress.period.weeklyDone}
          onClaim={onClaimTimed}
        />
      </div>

      <div data-reveal className="mt-5">
        <QuestPanel
          title="MILESTONES"
          icon={<FlameIcon className="size-3.5 text-accent" weight="fill" />}
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
  );
}

const NOTIFICATIONS_META = `${REMINDER_HOURS.length} × LOCAL`;

/** Format a reminder slot hour as HH:00 for display. */
function fmtSlotHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Enable / disable local-time journal reminders on this device. */
function NotificationsPanel({ token }: { token: string | null }) {
  const supported = pushSupported() && pushConfigured();
  const [permission, setPermission] = useState<NotificationPermission>(() => pushPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) {
      return;
    }

    let live = true;
    void currentSubscription().then((sub) => {
      if (live) {
        setSubscribed(Boolean(sub));
      }
    });

    return () => {
      live = false;
    };
  }, [supported]);

  /** Request permission, subscribe, and register with the server. */
  const onEnable = async () => {
    if (!token) {
      setStatus('// session expired · sign in again');

      return;
    }

    setBusy(true);

    try {
      const result = await enablePush(token);
      setPermission(result);

      if (result === 'granted') {
        setSubscribed(true);
        setStatus(`// reminders on · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        SoundManager.confirm();
      } else {
        setStatus('// permission not granted');
        SoundManager.deny();
      }
    } catch (err) {
      setStatus(`// failed · ${err instanceof Error ? err.message : 'could not subscribe'}`);
      SoundManager.deny();
    } finally {
      setBusy(false);
    }
  };

  /** Drop the server row, then the local subscription. */
  const onDisable = async () => {
    if (!token) {
      setStatus('// session expired · sign in again');

      return;
    }

    setBusy(true);

    try {
      await disablePush(token);
      setSubscribed(false);
      setStatus('// reminders off');
      SoundManager.confirm();
    } catch (err) {
      setStatus(`// failed · ${err instanceof Error ? err.message : 'could not unsubscribe'}`);
      SoundManager.deny();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Bracket>
      <Panel title="NOTIFICATIONS" meta={NOTIFICATIONS_META}>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-micro tracking-[0.12em] text-fg-mute">
            {REMINDER_HOURS.map((hour) => (
              <span key={hour}>{fmtSlotHour(hour)}</span>
            ))}
          </div>
          {!pushConfigured() ? (
            <p className="font-mono text-micro leading-[1.6] tracking-[0.04em] text-fg-mute">
              // reminders unavailable · VITE_VAPID_PUBLIC_KEY not set at build time
            </p>
          ) : !supported ? (
            <p className="font-mono text-micro leading-[1.6] tracking-[0.04em] text-fg-mute">
              // push not supported on this browser · on iOS, add Journs to the home screen first
            </p>
          ) : permission === 'denied' ? (
            <p className="font-mono text-micro leading-[1.6] tracking-[0.04em] text-fg-mute">
              // blocked · re-enable notifications in browser site settings
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Btn
                  variant="ghost"
                  disabled={busy || !token}
                  onClick={() => void (subscribed ? onDisable() : onEnable())}
                >
                  {subscribed ? (
                    <BellSlashIcon className="size-3.5" weight="bold" />
                  ) : (
                    <BellIcon className="size-3.5" weight="bold" />
                  )}
                  {busy ? 'WORKING…' : subscribed ? 'DISABLE REMINDERS' : 'ENABLE REMINDERS'}
                </Btn>
              </div>
              <p className="font-mono text-micro leading-[1.6] tracking-[0.04em] text-fg-mute">
                // {REMINDER_HOURS.length} nudges to write, on this device's local clock · no entry
                content ever leaves encrypted
              </p>
            </>
          )}
          {status && (
            <p className="font-mono text-micro tracking-[0.04em] text-fg-mute">{status}</p>
          )}
        </div>
      </Panel>
    </Bracket>
  );
}

/** Label / value telemetry row. */
function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
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
  icon,
  meta,
  quests,
  entries,
  progress,
  doneIds,
  onClaim,
  milestone,
}: {
  title: string;
  icon: ReactNode;
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
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            {icon}
            {title}
          </span>
        }
        meta={meta}
      >
        <ul className="flex flex-col gap-3">
          {quests.map((q) => {
            const satisfied = isQuestSatisfied(q, entries, progress.period);
            const claimed = milestone
              ? Boolean(q.tag && progress.claimedTags.includes(q.tag))
              : doneIds.includes(q.id);
            const ratio = questProgressRatio(q, entries, progress.period);
            const pct = Math.round((ratio.current / Math.max(1, ratio.target)) * 100);

            return (
              <li key={q.id} className="border border-line bg-black/20 px-3 py-3 max-phone:px-2.5">
                <div className="mb-2 flex flex-col gap-2 phone:flex-row phone:items-start phone:justify-between">
                  <div className="min-w-0">
                    <div className="font-headline text-meta font-semibold tracking-[0.18em] text-fg">
                      {q.title}
                      {q.tag && (
                        <span className="ml-2 font-mono text-micro tracking-[0.08em] text-accent">
                          #{q.tag}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-meta text-fg-dim">{q.detail}</div>
                  </div>
                  <div className="shrink-0 font-mono text-micro tracking-[0.12em] text-fg-mute">
                    {milestone ? (claimed ? 'CLAIMED' : 'TAG') : `+${q.aura} AURA`}
                  </div>
                </div>
                <div className="mb-2.5 h-1 w-full bg-line-strong">
                  <div
                    className="h-full bg-accent shadow-[0_0_8px_var(--accent)] transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-micro text-fg-mute">
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

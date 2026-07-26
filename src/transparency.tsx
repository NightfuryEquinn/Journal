import { useEffect, useRef, type ReactNode } from 'react';
import { Bracket, Panel, Btn, DecodeText } from './hud';

const DIAGRAM = `flowchart LR
  subgraph device [Device]
    Phrase[RecoveryPhrase]
    Pass[Passphrase]
    DEK[DataEncryptionKey]
    UI[ReactApp]
  end
  subgraph vercel [Vercel_host_and_serverless]
    Auth["/api/auth"]
    Entries["/api/entries"]
    Quests["/api/quests"]
    Settle["/api/cron/settle"]
  end
  subgraph external [cron_job_org]
    CronJob[ScheduledHTTP]
  end
  subgraph mongo [MongoDB]
    Users[(users)]
    EncEntries[(entries ciphertext)]
    Progress[(quest_progress)]
  end
  Phrase --> DEK
  Pass --> DEK
  UI -->|"encrypt then sync"| Entries
  UI --> Auth
  Auth --> Users
  Entries --> EncEntries
  UI --> Quests
  Quests --> Progress
  CronJob -->|"POST + CRON_SECRET"| Settle
  Settle --> Progress
`;

type SchemaField = {
  name: string;
  type: string;
  note: string;
};

/** Section heading for transparency copy. */
function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 font-display text-[12px] font-semibold tracking-[0.22em] text-fg uppercase">
      {children}
    </h2>
  );
}

/** Body paragraph for transparency copy. */
function Body({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[12px] leading-[1.7] text-fg-dim last:mb-0">{children}</p>
  );
}

/** Muted inline code / field name. */
function Code({ children }: { children: ReactNode }) {
  return <span className="tracking-[0.02em] text-accent">{children}</span>;
}

/** Schema field table for a document or payload shape. */
function SchemaTable({
  title,
  meta,
  fields,
  intro,
}: {
  title: string;
  meta: string;
  fields: SchemaField[];
  intro?: string;
}) {
  return (
    <Bracket>
      <Panel title={title} meta={meta}>
        {intro && <Body>{intro}</Body>}
        <div className="overflow-x-auto border border-line bg-black/25">
          <table className="w-full min-w-70 border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-line text-left text-[9.5px] tracking-[0.16em] text-fg-mute uppercase">
                <th className="px-2.5 py-2 font-medium">Field</th>
                <th className="px-2.5 py-2 font-medium">Type</th>
                <th className="px-2.5 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.name} className="border-b border-line/70 last:border-0">
                  <td className="px-2.5 py-2 align-top tracking-[0.04em] text-accent">{f.name}</td>
                  <td className="px-2.5 py-2 align-top text-fg-mute">{f.type}</td>
                  <td className="px-2.5 py-2 align-top leading-[1.55] text-fg-dim">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Bracket>
  );
}

const JOURNAL_ENTRY_FIELDS: SchemaField[] = [
  { name: 'id', type: 'string', note: 'Client id, e.g. e-YYYY-MM-DD-<rand>. Never reused after purge.' },
  { name: 'date', type: 'ISO string', note: 'Entry timestamp (ISO-8601). Sorted newest-first in the archive.' },
  { name: 'title', type: 'string', note: 'Short label shown in list / reader.' },
  { name: 'mood', type: '1–5 int', note: 'Self-report mood. LOW → HIGH in the composer.' },
  { name: 'energy', type: '1–5 int', note: 'Self-report energy. DRAINED → PEAKED.' },
  { name: 'weather', type: 'string', note: 'CLEAR, OVERCAST, WINDY, LIGHT/HEAVY RAIN, FOG, or SNOW.' },
  { name: 'tags', type: 'string[]', note: 'Free tags plus milestone tags (pioneer, chronicler, archivist).' },
  { name: 'body', type: 'string', note: 'Full journal text. Encrypted before leaving the device.' },
];

const ENCRYPTED_ENTRY_FIELDS: SchemaField[] = [
  { name: 'entryId', type: 'string', note: 'Same as plaintext JournalEntry.id.' },
  { name: 'ciphertext', type: 'hex', note: 'AES-GCM of JSON(JournalEntry). Opaque to the server.' },
  { name: 'nonce', type: 'hex', note: '12-byte IV for AES-GCM.' },
  { name: 'schemaVersion', type: 'int', note: 'Payload version; currently 1.' },
  { name: 'updatedAt', type: 'Date', note: 'Server write time (Mongo entries only).' },
];

const USER_DOC_FIELDS: SchemaField[] = [
  { name: 'accountId', type: 'hex', note: 'SHA-256(journs:v1:account: || seed). Public identifier.' },
  { name: 'salt', type: 'hex', note: '32-byte PBKDF2 salt for the passphrase KEK.' },
  { name: 'wrappedDekPass', type: 'hex', note: 'nonce||cipher DEK under passphrase KEK.' },
  { name: 'wrappedDekRecovery', type: 'hex', note: 'nonce||cipher DEK under recovery KEK (from mnemonic).' },
  { name: 'authVerifier', type: 'hex', note: 'SHA-256(HKDF(passKek, journs-auth)). Login proof without sending the passphrase.' },
  { name: 'lastActiveAt', type: 'Date', note: 'Updated on login and authenticated writes. Used by purge-stale.' },
  { name: 'createdAt', type: 'Date', note: 'Account creation time.' },
  { name: 'updatedAt', type: 'Date', note: 'Last user-doc mutation.' },
];

const QUEST_PROGRESS_FIELDS: SchemaField[] = [
  { name: 'accountId', type: 'string', note: 'Owner account (Mongo quest_progress).' },
  { name: 'aura', type: 'int ≥ 0', note: 'Temporary score. Accrues on claim; deducts when periods roll with misses.' },
  { name: 'claimedTags', type: 'string[]', note: 'Milestone tags already claimed: pioneer, chronicler, archivist.' },
  { name: 'period.dayKey', type: 'YYYY-MM-DD', note: 'UTC day window for daily quests.' },
  { name: 'period.weekKey', type: 'YYYY-Www', note: 'UTC ISO week window for weekly quests.' },
  { name: 'period.dailyDone', type: 'string[]', note: 'Quest ids claimed today (e.g. daily-write).' },
  { name: 'period.weeklyDone', type: 'string[]', note: 'Quest ids claimed this week (e.g. weekly-three).' },
  { name: 'lastSettledAt', type: 'ISO | null', note: 'Last settleAura run (client or cron).' },
  { name: 'updatedAt', type: 'Date', note: 'Server write time.' },
];

/** How Journs moves data: E2EE journal path vs plaintext quest path. */
export function TransparencyScreen({ onBack }: { onBack: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    /** Render the Mermaid data-flow diagram once. */
    const render = async () => {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        fontFamily: 'JetBrains Mono, monospace',
      });

      const id = `journs-flow-${Date.now()}`;
      const { svg } = await mermaid.render(id, DIAGRAM);

      if (!cancelled && hostRef.current) {
        hostRef.current.innerHTML = svg;
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-350 px-4 pt-4 pb-6 max-phone:px-3 laptop:px-7 laptop:pt-5 laptop:pb-7">
      <div className="mb-5.5 flex flex-wrap items-center gap-2.5">
        <Btn variant="ghost" onClick={onBack} data-tour="tour-back-profile">
          ← PROFILE
        </Btn>
        <span className="font-mono text-[11px] tracking-[0.14em] text-fg-mute">
          / TRANSPARENCY / DATA PATH
        </span>
      </div>

      <div className="flex flex-col gap-5">
        <Bracket>
          <Panel title="DATA TRANSFER" meta="E2EE · ZERO KNOWLEDGE JOURNAL">
            <p className="mb-4 font-mono text-[12px] leading-[1.7] text-fg-dim">
              <DecodeText
                text="// Journal bodies are encrypted on-device before they reach Vercel or MongoDB. Quest/AURA state is plaintext so cron-job.org can settle daily and weekly windows. Export stays on your machine."
                speed={10}
              />
            </p>
            <div
              ref={hostRef}
              data-tour="tour-diagram"
              className="overflow-x-auto border border-line bg-black/30 p-3 font-mono text-[11px] [&_svg]:mx-auto [&_svg]:max-w-full"
            />
          </Panel>
        </Bracket>

        <Bracket>
          <Panel title="OVERVIEW" meta="TRUST BOUNDARIES">
            <Heading>Two paths</Heading>
            <Body>
              Journs splits data into an end-to-end encrypted journal path and a plaintext quest
              path. The DEK, recovery phrase, passphrase, and decrypted entries never leave the
              browser. The API and MongoDB only ever see wraps, verifiers, ciphertext, and quest
              progress.
            </Body>

            <Heading>Device</Heading>
            <Body>
              A BIP39 12-word mnemonic seeds the account. From the seed Journs derives{' '}
              <Code>accountId</Code> and a recovery KEK. A random 32-byte DEK encrypts every
              journal entry with AES-GCM. The passphrase derives a KEK via PBKDF2-SHA-256 (600k
              iterations) that wraps the DEK and produces <Code>authVerifier</Code> for unlock —
              the passphrase itself is never sent.
            </Body>

            <Heading>Host & database</Heading>
            <Body>
              Vercel serverless routes under <Code>/api/*</Code> authenticate with a 12-hour HS256
              JWT (<Code>{'{ accountId }'}</Code>). MongoDB Atlas holds three collections:{' '}
              <Code>users</Code> (wraps + verifier), <Code>entries</Code> (ciphertext only), and{' '}
              <Code>quest_progress</Code> (readable AURA / quest state). Settlement is triggered by
              cron-job.org posting to <Code>/api/cron/settle</Code> with{' '}
              <Code>Authorization: Bearer CRON_SECRET</Code> — not Vercel Cron.
            </Body>

            <Heading>Local-only surfaces</Heading>
            <Body>
              Profile export writes decrypted JSON on your machine. Import merges by entry{' '}
              <Code>id</Code>, re-encrypts, and syncs. Device identity is cached in{' '}
              <Code>localStorage</Code> key <Code>journs.identity.v1</Code> without the DEK.
              Audio preference uses <Code>journs.sound</Code>; the Shepherd tour flag is{' '}
              <Code>journs.tour.v1</Code>.
            </Body>
          </Panel>
        </Bracket>

        <SchemaTable
          title="JOURNAL ENTRY"
          meta="PLAINTEXT · CLIENT ONLY"
          intro="Zod: journalEntrySchema in shared/schemas.ts. Exists in memory after decrypt, and in export/import JSON. Never stored as plaintext on the server."
          fields={JOURNAL_ENTRY_FIELDS}
        />

        <SchemaTable
          title="ENCRYPTED ENTRY"
          meta="WIRE · Mongo entries"
          intro="Zod: encryptedEntrySchema. PUT /api/entries upserts an array of these. GET returns the same shape plus updatedAt."
          fields={ENCRYPTED_ENTRY_FIELDS}
        />

        <SchemaTable
          title="USER DOCUMENT"
          meta="Mongo users"
          intro="Auth material only. No journal plaintext. Register and recover POST the wrap fields; login proves possession of the passphrase via authVerifier."
          fields={USER_DOC_FIELDS}
        />

        <SchemaTable
          title="QUEST PROGRESS"
          meta="PLAINTEXT · Mongo quest_progress"
          intro="Zod: questProgressSchema. Readable by the settle cron so day/week rollover can deduct missed AURA without the DEK. UTC keys keep client and cron aligned."
          fields={QUEST_PROGRESS_FIELDS}
        />

        <Bracket>
          <Panel title="QUEST DEFINITIONS" meta="shared/quests.ts">
            <Heading>Daily</Heading>
            <Body>
              <Code>daily-write</Code> (+10) — write ≥1 entry today. <Code>daily-tag</Code> (+5) —
              use ≥1 tag on an entry today. Tracked in <Code>period.dailyDone</Code>.
            </Body>
            <Heading>Weekly</Heading>
            <Body>
              <Code>weekly-three</Code> (+25) — ≥3 entries this UTC week.{' '}
              <Code>weekly-mood</Code> (+15) — log mood ≥4 once. Tracked in{' '}
              <Code>period.weeklyDone</Code>.
            </Body>
            <Heading>Milestones</Heading>
            <Body>
              <Code>ms-pioneer</Code> → tag pioneer (first entry). <Code>ms-chronicler</Code> →
              chronicler (7 entries). <Code>ms-archivist</Code> → archivist (30 entries). Zero AURA;
              stored in <Code>claimedTags</Code>.
            </Body>
          </Panel>
        </Bracket>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
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
    </div>
  );
}

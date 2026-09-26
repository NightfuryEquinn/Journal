// legal.tsx — Privacy Policy and Terms & Conditions, static in-app copy
import { useRef } from 'react';
import { CaretLeftIcon } from '@phosphor-icons/react';
import { Bracket, Panel, Btn, PAGE } from './hud';
import { Heading, Body, Code } from './transparency';
import { useEntrance } from './motion';
import type { LegalDoc } from './types';

/** Bump alongside package.json; shown in the footer of both documents. */
const LEGAL_VERSION = '1.1.1';
const EFFECTIVE_DATE = '26 September 2026';

interface LegalScreenProps {
  doc: LegalDoc;
  onBack: () => void;
  /** "PROFILE" or "HOME", depending on where the doc was opened from. */
  backLabel?: string;
}

/** Privacy Policy or Terms & Conditions, reached from the landing page or Profile → Data. */
export function LegalScreen({ doc, onBack, backLabel = 'PROFILE' }: LegalScreenProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  useEntrance(scopeRef);
  const title = doc === 'privacy' ? 'PRIVACY POLICY' : 'TERMS & CONDITIONS';

  return (
    <div ref={scopeRef} className={PAGE}>
      <div data-reveal className="mb-5.5 flex flex-wrap items-center gap-2.5">
        <Btn variant="ghost" onClick={onBack}>
          <CaretLeftIcon className="size-3.5" weight="bold" />
          {backLabel}
        </Btn>
        <span className="font-mono text-meta tracking-[0.14em] text-fg-mute">/ {title}</span>
      </div>

      <div data-reveal className="mx-auto max-w-3xl">
        <Bracket>
          <Panel title={title} meta={`v${LEGAL_VERSION} · ${EFFECTIVE_DATE}`}>
            {doc === 'privacy' ? <PrivacyContent /> : <TermsContent />}
            <p className="mt-5 border-t border-line pt-3.5 font-mono text-micro tracking-[0.02em] text-fg-mute">
              Version {LEGAL_VERSION} · Last updated {EFFECTIVE_DATE}
            </p>
          </Panel>
        </Bracket>
      </div>
    </div>
  );
}

/** Privacy Policy body copy. */
function PrivacyContent() {
  return (
    <>
      <Heading>Who this covers</Heading>
      <Body>
        Journs is a personal, independently-run project by <Code>Yip Zi Xian</Code> (
        <Code>github.com/NightfuryEquinn</Code>). This policy explains what Journs collects, why,
        and — just as importantly — what it deliberately never sees.
      </Body>

      <Heading>What we never see</Heading>
      <Body>
        Your recovery phrase, your device passphrase, and the plaintext of anything you write are
        never transmitted to our servers. Every journal entry is encrypted with AES-GCM inside your
        browser, using a key derived from your passphrase or recovery phrase, before it ever leaves
        your device.
      </Body>

      <Heading>What we do store</Heading>
      <Body>
        A public account identifier derived from your recovery phrase; a random salt and wrapped
        copies of your encryption key (still unreadable without your passphrase or phrase); the
        encrypted (ciphertext) body of each journal entry; and plaintext quest/AURA progress
        (streaks, claimed tags) — this isn&rsquo;t sensitive, so it stays readable, which is what
        lets daily and weekly windows settle automatically. The exact schema is on the in-app{' '}
        <Code>TRANSPARENCY</Code> page.
      </Body>

      <Heading>Push notifications (optional)</Heading>
      <Body>
        If you enable reminders, we store the browser-provided push subscription endpoint, its
        encryption keys, and your device&rsquo;s time zone, so a nudge can be sent at the right
        local hour. The nudge text is a public quote — never your journal content. Disabling
        reminders removes this row.
      </Body>

      <Heading>Analytics</Heading>
      <Body>
        We use Vercel Analytics for anonymous page-view counts. It doesn&rsquo;t use cookies,
        doesn&rsquo;t track you across other sites, and never receives journal content.
      </Body>

      <Heading>Local storage on your device</Heading>
      <Body>
        Your browser&rsquo;s <Code>localStorage</Code> holds a small device-identity cache (no DEK,
        passphrase, or verifier), a sound on/off preference, and whether you&rsquo;ve completed the
        product tour. None of it is sent to us.
      </Body>

      <Heading>How long we keep it</Heading>
      <Body>
        Individual entries can be deleted at any time from the archive. Accounts inactive for more
        than 90 days may be purged along with their entries and progress. Because we never collect
        an email address or name, we have no way to verify who &ldquo;you&rdquo; are beyond your
        recovery phrase — treat it as both your login and your proof of ownership.
      </Body>

      <Heading>Who else sees it</Heading>
      <Body>
        Hosting and the database run on Vercel and MongoDB Atlas. Scheduled quest/streak settlement
        is triggered by cron-job.org, which only calls an endpoint — it never receives your data.
        Nothing is sold, and nothing is shared for advertising.
      </Body>

      <Heading>Changes</Heading>
      <Body>
        If this policy changes in a way that matters, the version number and date below will change
        too. There&rsquo;s no mailing list to notify, since we don&rsquo;t collect an email address.
      </Body>

      <Heading>Questions</Heading>
      <Body>
        Reach the maintainer through the project&rsquo;s GitHub repository:{' '}
        <Code>github.com/NightfuryEquinn/Journal</Code>.
      </Body>
    </>
  );
}

/** Terms & Conditions body copy. */
function TermsContent() {
  return (
    <>
      <Heading>Acceptance</Heading>
      <Body>
        By creating an account or using Journs, you agree to these terms. If you don&rsquo;t agree,
        please don&rsquo;t use the app.
      </Body>

      <Heading>What Journs is</Heading>
      <Body>
        Journs is a personal, independently-run journaling app, provided as-is by a solo developer
        as a side project — not a company, and not a service with an SLA.
      </Body>

      <Heading>Your account and recovery phrase</Heading>
      <Body>
        Your 12-word recovery phrase and device passphrase are the only way into your account. There
        is no email-based recovery. If you lose both, your entries are permanently unrecoverable —
        we have no way to reset them, by design.
      </Body>

      <Heading>Your content</Heading>
      <Body>
        You own everything you write. Because entries are encrypted client-side, we cannot read,
        moderate, or remove your journal content even if we wanted to. You&rsquo;re responsible for
        what you write and for keeping your recovery phrase safe.
      </Body>

      <Heading>Acceptable use</Heading>
      <Body>
        Don&rsquo;t use Journs to store or transmit illegal content, attempt to breach the service,
        or interfere with other accounts. We may suspend or purge accounts that abuse the service —
        for example, automated account creation or attempts to overload the API.
      </Body>

      <Heading>Availability</Heading>
      <Body>
        Journs runs on free/low-cost infrastructure (Vercel, MongoDB Atlas) maintained in spare
        time. Uptime isn&rsquo;t guaranteed, and the service may change, pause, or shut down at any
        time. Regularly exporting your journal (Profile → Data → Export) is the best way to keep
        your own copy.
      </Body>

      <Heading>Quests and AURA</Heading>
      <Body>
        AURA points, streaks, and milestone tags are for fun. They have no monetary value, cannot be
        transferred, and may be reset or recalculated if a bug is found.
      </Body>

      <Heading>Limitation of liability</Heading>
      <Body>
        Journs is provided &ldquo;as is.&rdquo; To the fullest extent permitted by law, the
        maintainer is not liable for any data loss, downtime, or damages arising from use of the app
        — including loss of a recovery phrase.
      </Body>

      <Heading>Changes to these terms</Heading>
      <Body>
        These terms may be updated as the app evolves. Continuing to use Journs after a change means
        you accept the update.
      </Body>

      <Heading>Contact</Heading>
      <Body>
        <Code>github.com/NightfuryEquinn/Journal</Code>.
      </Body>
    </>
  );
}

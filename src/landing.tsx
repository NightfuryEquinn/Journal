// landing.tsx — pre-auth marketing page. Lazy-loaded; skipped on returning devices.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createTimeline, stagger } from 'animejs';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellRingingIcon,
  BookOpenIcon,
  BookOpenTextIcon,
  CaretRightIcon,
  CloudArrowUpIcon,
  CloudSunIcon,
  FeatherIcon,
  FlameIcon,
  KeyIcon,
  LockKeyIcon,
  MoonIcon,
  MoonStarsIcon,
  PencilLineIcon,
  QuotesIcon,
  ShieldCheckIcon,
  SunHorizonIcon,
  SunIcon,
  type Icon,
} from '@phosphor-icons/react';
import { Bracket, Panel, Btn, DecodeText } from './hud';
import { useEntrance, useEnterOnScroll, useScrubReveal, prefersReducedMotion } from './motion';
import { QUOTES, REMINDER_HOURS } from '../shared/push';

const SAMPLE_CIPHER = Array.from({ length: 44 }, () =>
  Math.floor(Math.random() * 16).toString(16),
).join('');
const DUMMY_WORDS = ['orbit', 'maple', 'signal', 'ember', 'quiet', 'anchor', 'delta', 'lumen'];

type Intent = 'create' | 'recover' | undefined;

interface LandingScreenProps {
  hasIdentity: boolean;
  /** An active, signed-in session — distinct from `hasIdentity`, which only means a device is bound. */
  authed: boolean;
  onEnter: (intent?: Intent) => void;
  /** Return to the archive without re-authenticating; only meaningful when `authed`. */
  onOpenArchive: () => void;
  onOpenTransparency: () => void;
}

/** Public marketing page — nav, hero, privacy bento, how-it-works, rituals, quotes, CTA. */
export function LandingScreen({
  hasIdentity,
  authed,
  onEnter,
  onOpenArchive,
  onOpenTransparency,
}: LandingScreenProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  useEntrance(scopeRef);

  return (
    <main ref={scopeRef} className="relative w-full max-w-full overflow-x-hidden">
      <LandingNav
        hasIdentity={hasIdentity}
        authed={authed}
        onEnter={onEnter}
        onOpenArchive={onOpenArchive}
        onOpenTransparency={onOpenTransparency}
      />
      <Hero
        hasIdentity={hasIdentity}
        authed={authed}
        onEnter={onEnter}
        onOpenArchive={onOpenArchive}
      />
      <BentoSection />
      <ScrubSection />
      <HowSection />
      <RitualsSection />
      <QuoteCarousel />
      <ClosingSection
        hasIdentity={hasIdentity}
        authed={authed}
        onEnter={onEnter}
        onOpenArchive={onOpenArchive}
        onOpenTransparency={onOpenTransparency}
      />
      <LandingFooter
        authed={authed}
        onEnter={onEnter}
        onOpenArchive={onOpenArchive}
        onOpenTransparency={onOpenTransparency}
      />
    </main>
  );
}

/** Floating glass nav bar with anchor links and entry CTAs. */
function LandingNav({
  hasIdentity,
  authed,
  onEnter,
  onOpenArchive,
  onOpenTransparency,
}: {
  hasIdentity: boolean;
  authed: boolean;
  onEnter: (intent?: Intent) => void;
  onOpenArchive: () => void;
  onOpenTransparency: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-6xl items-center justify-between gap-4 border border-line-strong bg-bg/70 px-4 py-2.5 backdrop-blur-md [clip-path:polygon(0_0,calc(100%-14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%-14px))]">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="size-6" />
          <span className="font-headline text-ui font-semibold tracking-[0.28em] text-fg">
            JOURNS
          </span>
        </div>
        <div className="hidden items-center gap-6 font-mono text-meta tracking-[0.14em] text-fg-dim laptop:flex">
          <a href="#privacy" className="hover:text-accent">
            PRIVACY
          </a>
          <a href="#how" className="hover:text-accent">
            HOW IT WORKS
          </a>
          <a href="#rituals" className="hover:text-accent">
            RITUALS
          </a>
          <button type="button" className="hover:text-accent" onClick={onOpenTransparency}>
            TRANSPARENCY
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!authed && !hasIdentity && (
            <Btn
              variant="ghost"
              onClick={() => onEnter('recover')}
              className="hidden phone:inline-flex"
            >
              RECOVER
            </Btn>
          )}
          <Btn
            variant="primary"
            onClick={authed ? onOpenArchive : () => onEnter(hasIdentity ? undefined : 'create')}
          >
            {authed ? 'OPEN ARCHIVE' : hasIdentity ? 'UNLOCK' : 'START WRITING'}
          </Btn>
        </div>
      </div>
    </nav>
  );
}

/** Loops a sample journal line between plaintext and its ciphertext, every 4s. */
function CipherPreview() {
  const PLAIN = 'wrote three pages today, felt lighter.';
  const [showCipher, setShowCipher] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    const id = setInterval(() => setShowCipher((v) => !v), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative z-10 w-full text-center font-mono text-meta break-all text-fg-dim">
      <DecodeText
        key={showCipher ? 'c' : 'p'}
        text={showCipher ? SAMPLE_CIPHER : PLAIN}
        speed={16}
      />
    </div>
  );
}

/** Editorial-split hero: wide two-to-three-line H1, dual CTAs, live cipher panel. */
function Hero({
  hasIdentity,
  authed,
  onEnter,
  onOpenArchive,
}: {
  hasIdentity: boolean;
  authed: boolean;
  onEnter: (intent?: Intent) => void;
  onOpenArchive: () => void;
}) {
  const wordsRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const words = wordsRef.current?.querySelectorAll<HTMLElement>('.hero-word');

    if (prefersReducedMotion() || !words?.length || !ctaRef.current || !panelRef.current) {
      return;
    }

    const tl = createTimeline({ defaults: { ease: 'outQuad' } });
    tl.add(words, { opacity: [0, 1], translateY: [20, 0], duration: 600, delay: stagger(45) })
      .add(ctaRef.current, { opacity: [0, 1], translateY: [12, 0], duration: 500 }, '-=250')
      .add(
        panelRef.current,
        { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'], duration: 700 },
        '-=300',
      );

    return () => {
      tl.pause();
    };
  }, []);

  return (
    <section className="relative overflow-hidden px-4 pt-32 pb-24 laptop:px-[6vw] laptop:pt-44 laptop:pb-32">
      <div className="mesh-glow" />
      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-12 laptop:grid-cols-12 laptop:gap-8">
        <div className="laptop:col-span-7">
          <h1
            ref={wordsRef}
            className="max-w-4xl font-headline text-[clamp(2.75rem,5vw,5.5rem)] leading-[0.95] font-semibold tracking-[-0.01em] text-fg"
          >
            <span className="hero-word inline-block">A</span>{' '}
            <span className="hero-word inline-block">journal</span>{' '}
            <span className="hero-word inline-block">only</span>{' '}
            <span className="hero-word inline-flex translate-y-[0.06em] items-center gap-2 bg-accent-soft px-4 align-middle text-accent">
              <LockKeyIcon className="size-[0.55em]" weight="duotone" />
              you
            </span>{' '}
            <span className="hero-word inline-block">can</span>{' '}
            <span className="hero-word inline-block">open.</span>
          </h1>
          <p className="mt-6 max-w-xl font-mono text-lead text-fg-dim">
            // twelve words seed the key. everything you write is encrypted before it leaves this
            device — Journs and its servers never see the plaintext.
          </p>
          <div ref={ctaRef} className="mt-9 flex flex-wrap gap-3">
            <Btn
              variant="primary"
              onClick={authed ? onOpenArchive : () => onEnter(hasIdentity ? undefined : 'create')}
            >
              <CaretRightIcon className="size-3.5" weight="bold" />
              {authed ? 'OPEN ARCHIVE' : hasIdentity ? 'UNLOCK THIS DEVICE' : 'START WRITING'}
            </Btn>
            {!authed && !hasIdentity && (
              <Btn variant="ghost" onClick={() => onEnter('recover')}>
                RECOVER WITH 12 WORDS
              </Btn>
            )}
          </div>
        </div>

        <div className="laptop:col-span-4 laptop:col-start-9">
          <div ref={panelRef}>
            <Bracket>
              <Panel title="LIVE CIPHER" meta="AES-GCM">
                <div className="relative flex min-h-40 items-center justify-center overflow-hidden">
                  <LockKeyIcon
                    className="pointer-events-none absolute -right-4 -bottom-4 size-32 text-line-strong/40"
                    weight="duotone"
                    aria-hidden="true"
                  />
                  <CipherPreview />
                </div>
              </Panel>
            </Bracket>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One card in the gapless privacy bento grid. */
function BentoCard({
  className = '',
  icon,
  title,
  children,
}: {
  className?: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`group relative flex flex-col justify-between gap-5 overflow-hidden border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.2)),var(--bg-1)] p-6 transition-colors duration-300 hover:border-accent ${className}`}
    >
      <span className="flex size-10 items-center justify-center border border-line-strong bg-accent-soft text-accent transition-transform duration-700 group-hover:scale-110">
        {icon}
      </span>
      <div>
        <h3 className="mb-2 font-headline text-lg font-semibold text-fg">{title}</h3>
        <div className="font-mono text-meta text-fg-dim">{children}</div>
      </div>
    </div>
  );
}

/** Gapless 4-card bento: sealed storage, the 12-word account, aura, reminders. */
function BentoSection() {
  return (
    <section id="privacy" className="scroll-mt-24 px-4 py-32 laptop:px-[6vw] laptop:py-48">
      <div className="mx-auto max-w-6xl">
        <h2
          data-reveal
          className="mb-12 max-w-2xl font-headline text-4xl font-semibold leading-tight text-fg laptop:text-5xl"
        >
          Nothing leaves this device unless it&rsquo;s already sealed.
        </h2>
        <div
          data-reveal
          className="grid grid-flow-dense grid-cols-1 gap-4 phone:grid-cols-2 laptop:grid-cols-4"
        >
          <BentoCard
            className="phone:col-span-2 laptop:col-span-2 laptop:row-span-2"
            icon={<ShieldCheckIcon className="size-5" weight="bold" />}
            title="Sealed on this device"
          >
            <p className="mb-3">
              Every entry is AES-GCM encrypted in your browser before it ever reaches a network
              request. Vercel and MongoDB only ever handle ciphertext.
            </p>
            <DecodeText text={SAMPLE_CIPHER} speed={20} className="block break-all text-fg-mute" />
          </BentoCard>
          <BentoCard
            className="phone:col-span-2"
            icon={<KeyIcon className="size-5" weight="bold" />}
            title="Twelve words. No email."
          >
            <p className="mb-3">
              A BIP39 phrase is your whole account. No inbox, no password reset, no third party to
              breach.
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {DUMMY_WORDS.map((w, i) => (
                <span
                  key={i}
                  className="border border-line bg-black/30 px-1.5 py-1 text-center text-micro text-accent"
                >
                  {w}
                </span>
              ))}
            </div>
          </BentoCard>
          <BentoCard icon={<FlameIcon className="size-5" weight="bold" />} title="Aura and streaks">
            <p className="mb-3">
              Daily and weekly quests turn consistency into a score, without ever reading your
              words.
            </p>
            <div className="h-1.5 w-full bg-line-strong">
              <div className="h-full w-2/3 bg-accent shadow-[0_0_8px_var(--accent)]" />
            </div>
          </BentoCard>
          <BentoCard
            icon={<BellRingingIcon className="size-5" weight="bold" />}
            title="Five nudges a day"
          >
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_HOURS.map((h) => (
                <span key={h} className="border border-line px-1.5 py-0.5 text-micro text-fg-mute">
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

/** Centred paragraph whose words scrub into full opacity against scroll position. */
function ScrubSection() {
  const ref = useRef<HTMLDivElement>(null);
  useScrubReveal(ref, '.scrub-word');
  const text =
    'Your words are encrypted before they leave this device. Vercel forwards ciphertext. ' +
    'MongoDB stores ciphertext. Nobody but you holds the key that turns it back into a sentence.';

  return (
    <section className="px-4 py-32 laptop:px-[6vw] laptop:py-48">
      <div ref={ref} className="mx-auto max-w-5xl text-center">
        <p className="font-headline text-2xl leading-relaxed font-medium text-fg laptop:text-4xl">
          {text.split(' ').map((w, i) => (
            <span key={i} className="scrub-word mr-[0.28em] inline-block">
              {w}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

const HOW_STEPS: { icon: Icon; title: string; body: string }[] = [
  {
    icon: PencilLineIcon,
    title: 'Write',
    body: 'Compose in a console-style editor. Mood, energy, weather, tags — all optional context.',
  },
  {
    icon: LockKeyIcon,
    title: 'Seal',
    body: 'AES-GCM encrypts the entry in your browser, with a key only your passphrase or phrase can unwrap.',
  },
  {
    icon: CloudArrowUpIcon,
    title: 'Sync',
    body: 'Ciphertext syncs to MongoDB Atlas through a Vercel function. The server never sees plaintext.',
  },
  {
    icon: BookOpenTextIcon,
    title: 'Return',
    body: 'Open the archive from any device with your phrase or passphrase. Decryption happens locally, every time.',
  },
];

/** Sticky left column (native CSS, no JS pinning) beside four scroll-entering steps. */
function HowSection() {
  const ref = useRef<HTMLDivElement>(null);
  useEnterOnScroll(ref, '.how-step');

  return (
    <section id="how" className="scroll-mt-24 px-4 py-32 laptop:px-[6vw] laptop:py-48">
      <div
        ref={ref}
        className="mx-auto grid max-w-6xl grid-cols-1 gap-10 laptop:grid-cols-[minmax(0,360px)_1fr] laptop:gap-16"
      >
        <div data-reveal className="laptop:sticky laptop:top-28 laptop:self-start">
          <h2 className="mb-4 font-headline text-4xl font-semibold leading-tight text-fg">
            How it works
          </h2>
          <p className="max-w-sm font-mono text-body text-fg-dim">
            Four steps between an idea and a durable, encrypted record.
          </p>
          {/* ponytail: a static rail, not scroll-progress-linked — add a scroll-synced
              fill if the flat steps ever feel under-motivated. */}
          <div className="mt-8 flex gap-2 laptop:flex-col">
            {HOW_STEPS.map((s) => (
              <span
                key={s.title}
                className="h-1 flex-1 bg-line-strong laptop:h-8 laptop:w-1 laptop:flex-none"
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          {HOW_STEPS.map((s) => {
            const Icon = s.icon;

            return (
              <div
                key={s.title}
                className="how-step flex items-start gap-5 border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.2)),var(--bg-1)] p-6"
              >
                <span className="flex size-11 shrink-0 items-center justify-center border border-line-strong bg-accent-soft text-accent">
                  <Icon className="size-5" weight="bold" />
                </span>
                <div>
                  <h3 className="mb-1.5 font-headline text-lg font-semibold text-fg">{s.title}</h3>
                  <p className="font-mono text-meta text-fg-dim">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const RITUAL_ICONS = [SunHorizonIcon, SunIcon, CloudSunIcon, MoonStarsIcon, MoonIcon];
const RITUAL_GRADIENTS = [
  'from-[color-mix(in_oklab,var(--warn)_20%,transparent)]',
  'from-accent-soft',
  'from-[color-mix(in_oklab,var(--accent)_12%,transparent)]',
  'from-bg-2',
  'from-bg',
];

/** Horizontal accordion — five reminder slots, one per REMINDER_HOURS entry. */
function RitualsSection() {
  const [active, setActive] = useState(0);

  return (
    <section id="rituals" className="scroll-mt-24 px-4 py-32 laptop:px-[6vw] laptop:py-48">
      <div className="mx-auto max-w-6xl">
        <h2
          data-reveal
          className="mb-12 font-headline text-4xl font-semibold text-fg laptop:text-5xl"
        >
          Five moments a day to check back in.
        </h2>
        <div data-reveal className="flex flex-col gap-2 laptop:h-100 laptop:flex-row">
          {REMINDER_HOURS.map((hour, i) => {
            const Icon = RITUAL_ICONS[i]!;
            const isActive = active === i;
            const quote = QUOTES[(i * 11) % QUOTES.length]!;

            return (
              <button
                key={hour}
                type="button"
                aria-expanded={isActive}
                className={`group relative flex flex-col justify-end overflow-hidden border border-line-strong bg-gradient-to-b to-transparent p-5 text-left transition-[flex-grow] duration-500 ${RITUAL_GRADIENTS[i]} ${isActive ? 'flex-[4]' : 'flex-1'}`}
                style={{ minHeight: isActive ? 240 : 76 }}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              >
                <Icon className="mb-3 size-6 text-accent" weight="duotone" />
                <span className="font-mono text-ui tracking-[0.14em] text-fg">
                  {String(hour).padStart(2, '0')}:00
                </span>
                {isActive && (
                  <p className="mt-3 max-w-xs font-mono text-meta leading-relaxed text-fg-dim">
                    &ldquo;{quote.text}&rdquo; — {quote.author}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const CAROUSEL_QUOTES = [0, 15, 30, 45, 60, 75].map((i) => QUOTES[i % QUOTES.length]!);
const CAROUSEL_ICONS = [QuotesIcon, FeatherIcon, BookOpenIcon];

/** Rotating attributed quotes, crossfading via a plain CSS opacity transition. */
function QuoteCarousel() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const quote = CAROUSEL_QUOTES[index]!;

  /** Fade out, swap the quote, fade back in. */
  const go = (next: number) => {
    setVisible(false);
    window.setTimeout(() => {
      setIndex(next);
      setVisible(true);
    }, 180);
  };

  return (
    <section className="px-4 py-32 laptop:px-[6vw] laptop:py-48">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <div className="flex items-center justify-center">
          {CAROUSEL_ICONS.map((Icon, i) => (
            <span
              key={i}
              className="flex size-14 items-center justify-center border border-line-strong bg-bg-1 text-accent [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))]"
              style={{ marginLeft: i === 0 ? 0 : -16, zIndex: CAROUSEL_ICONS.length - i }}
            >
              <Icon className="size-6" weight="duotone" />
            </span>
          ))}
        </div>
        <div
          aria-live="polite"
          className={`transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        >
          <p className="max-w-xl font-headline text-2xl leading-relaxed font-medium text-fg laptop:text-3xl">
            &ldquo;{quote.text}&rdquo;
          </p>
          <span className="mt-3 block font-mono text-meta tracking-[0.14em] text-fg-mute">
            — {quote.author}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous quote"
            className="tap-target flex size-9 items-center justify-center border border-line-strong text-fg-dim hover:border-accent hover:text-accent"
            onClick={() => go((index - 1 + CAROUSEL_QUOTES.length) % CAROUSEL_QUOTES.length)}
          >
            <ArrowLeftIcon className="size-4" weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Next quote"
            className="tap-target flex size-9 items-center justify-center border border-line-strong text-fg-dim hover:border-accent hover:text-accent"
            onClick={() => go((index + 1) % CAROUSEL_QUOTES.length)}
          >
            <ArrowRightIcon className="size-4" weight="bold" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** Final massive CTA over a mesh glow. */
function ClosingSection({
  hasIdentity,
  authed,
  onEnter,
  onOpenArchive,
  onOpenTransparency,
}: {
  hasIdentity: boolean;
  authed: boolean;
  onEnter: (intent?: Intent) => void;
  onOpenArchive: () => void;
  onOpenTransparency: () => void;
}) {
  return (
    <section className="relative overflow-hidden px-4 py-32 laptop:px-[6vw] laptop:py-48">
      <div className="mesh-glow" />
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <h2 className="font-headline text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] font-semibold text-fg">
          Open your first log.
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Btn
            variant="primary"
            onClick={authed ? onOpenArchive : () => onEnter(hasIdentity ? undefined : 'create')}
          >
            <CaretRightIcon className="size-3.5" weight="bold" />
            {authed ? 'OPEN ARCHIVE' : hasIdentity ? 'UNLOCK THIS DEVICE' : 'START WRITING'}
          </Btn>
          <Btn variant="ghost" onClick={onOpenTransparency}>
            READ THE DATA PATH
          </Btn>
        </div>
      </div>
    </section>
  );
}

/** Wordmark, quick links, version line. */
function LandingFooter({
  authed,
  onEnter,
  onOpenArchive,
  onOpenTransparency,
}: {
  authed: boolean;
  onEnter: (intent?: Intent) => void;
  onOpenArchive: () => void;
  onOpenTransparency: () => void;
}) {
  return (
    <footer className="border-t border-line px-4 py-10 laptop:px-[6vw]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 laptop:flex-row laptop:items-center laptop:justify-between">
        <span className="font-headline text-ui font-semibold tracking-[0.28em] text-fg">
          JOURNS
        </span>
        <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-meta tracking-[0.08em] text-fg-dim">
          <button type="button" className="hover:text-accent" onClick={onOpenTransparency}>
            TRANSPARENCY
          </button>
          {authed ? (
            <button type="button" className="hover:text-accent" onClick={onOpenArchive}>
              OPEN ARCHIVE
            </button>
          ) : (
            <>
              <button
                type="button"
                className="hover:text-accent"
                onClick={() => onEnter(undefined)}
              >
                UNLOCK
              </button>
              <button
                type="button"
                className="hover:text-accent"
                onClick={() => onEnter('recover')}
              >
                RECOVER
              </button>
            </>
          )}
        </div>
        <span className="font-mono text-micro tracking-[0.08em] text-fg-mute">
          // v.1.0.1 · ciphertext only · © {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}

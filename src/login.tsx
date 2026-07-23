import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SoundManager, DecodeText, Bracket, Panel, Btn, Caret } from './hud';

const PASSPHRASE = 'journs'; // demo passphrase — display in hint
const TYPED_BOOT_LINES = [
  '$ journs.init --secure',
  '> binding to cluster ATL-07.mongodb.local:27017',
  '> handshake … TLS 1.3 OK',
  '> integrity check … sha256 OK',
  '> awaiting operator passphrase',
];

type LoginPhase = 'boot' | 'prompt' | 'verify' | 'ok' | 'fail';

/** Secure terminal login with boot sequence and ID card. */
export function LoginScreen({ onAuth }: { onAuth: (user: string) => void }) {
  const [phase, setPhase] = useState<LoginPhase>('boot');
  const [pwd, setPwd] = useState('');
  const [bootIdx, setBootIdx] = useState(0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase !== 'boot') {
      return;
    }

    SoundManager.boot();
    let i = 0;
    const id = setInterval(() => {
      i++;
      setBootIdx(i);

      if (i >= TYPED_BOOT_LINES.length) {
        clearInterval(id);
        setTimeout(() => {
          setPhase('prompt');
          setTimeout(() => inputRef.current?.focus(), 50);
        }, 400);
      }
    }, 420);

    return () => clearInterval(id);
  }, [phase]);

  /** Submit passphrase and run verify animation. */
  const submit = (e?: FormEvent) => {
    e?.preventDefault();

    if (phase === 'verify') {
      return;
    }

    setPhase('verify');
    SoundManager.click();
    setTimeout(() => {
      if (pwd.trim().toLowerCase() === PASSPHRASE) {
        SoundManager.confirm();
        setPhase('ok');
        setTimeout(() => onAuth('operator-01'), 900);
      } else {
        SoundManager.deny();
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPhase('prompt');
        setPwd('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }, 900);
  };

  return (
    <div className="relative grid min-h-full place-items-center px-4 py-8 max-phone:py-6 laptop:px-[6vw] laptop:py-10">
      <div className="grid w-full max-w-[980px] grid-cols-1 items-stretch gap-8 max-tablet:gap-6 tablet:grid-cols-[minmax(0,320px)_1fr] tablet:gap-10 laptop:gap-[60px]">
        <Bracket className="max-w-md justify-self-center tablet:max-w-none tablet:justify-self-stretch">
          <div
            className="flex flex-col gap-3.5 border border-line-strong bg-[linear-gradient(180deg,var(--bg-1),var(--bg))] p-4"
            style={{
              boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 14px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-display font-medium tracking-[0.12em] text-fg-dim uppercase">
                OPERATOR ID
              </span>
              <span className="font-mono tracking-[0.02em] text-fg-dim">// CL-A · CLEARED</span>
            </div>
            <div className="relative aspect-square border border-line-strong bg-bg">
              <svg viewBox="0 0 200 200" width="100%" height="100%">
                <defs>
                  <pattern id="g" width="6" height="6" patternUnits="userSpaceOnUse">
                    <path d="M0 6 L6 0" stroke="rgba(243,232,213,0.08)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="200" height="200" fill="url(#g)" />
                <circle cx="100" cy="78" r="28" stroke="var(--accent)" strokeWidth="1" fill="none" />
                <path d="M40 180 Q100 120 160 180" stroke="var(--accent)" strokeWidth="1" fill="none" />
                <g stroke="rgba(243,232,213,0.5)" strokeWidth="0.4" fill="none">
                  <line x1="12" y1="100" x2="34" y2="100" />
                  <line x1="166" y1="100" x2="188" y2="100" />
                  <line x1="100" y1="12" x2="100" y2="34" />
                  <line x1="100" y1="166" x2="100" y2="188" />
                </g>
                <text x="14" y="22" fill="var(--fg-mute)" fontFamily="JetBrains Mono" fontSize="8">
                  ID-7741
                </text>
                <text x="14" y="194" fill="var(--fg-mute)" fontFamily="JetBrains Mono" fontSize="8">
                  RECON
                </text>
                <text x="156" y="194" fill="var(--accent)" fontFamily="JetBrains Mono" fontSize="8">
                  ·LIVE
                </text>
              </svg>
            </div>
            <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px]">
              {(
                [
                  ['CALLSIGN', 'OPERATOR · 01', false],
                  ['VESSEL', 'JOURNS-01', false],
                  ['ROLE', 'SOLE AUTHOR', false],
                  ['CLEARANCE', 'CRUD · ALL', true],
                  ['BOUND', 'mongodb://journs.atl-07', false],
                ] as const
              ).map(([lbl, val, accent]) => (
                <div key={lbl} className="flex justify-between gap-3">
                  <span className="tracking-[0.16em] text-fg-mute">{lbl}</span>
                  <span className={accent ? 'text-accent' : 'text-fg'}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </Bracket>

        <div
          className={`relative min-w-0 tablet:[transform:perspective(1400px)_rotateY(-2deg)] tablet:[transform-style:preserve-3d] ${shake ? 'animate-shake' : ''}`}
        >
          <Panel title={<DecodeText text="SECURE TERMINAL" />} meta="tty/01 · 9600 8N1">
            <div className="flex min-h-[280px] flex-col gap-[18px] max-phone:min-h-[240px]">
              <div className="font-mono text-xs leading-[1.8]">
                {TYPED_BOOT_LINES.slice(0, bootIdx).map((l, i) => (
                  <div key={i} className={i === 0 ? 'text-fg' : 'text-fg-dim'}>
                    <DecodeText text={l} speed={12} />
                  </div>
                ))}
                {phase === 'boot' && bootIdx < TYPED_BOOT_LINES.length && (
                  <div>
                    <Caret />
                  </div>
                )}
              </div>
              {phase !== 'boot' && (
                <form onSubmit={submit}>
                  <label className="mb-2 block text-xs">
                    <span className="font-mono tracking-[0.02em] text-accent">operator@journs</span>
                    <span className="font-mono tracking-[0.02em] text-fg-dim"> :~$ </span>
                    <span className="font-mono tracking-[0.02em]">passphrase &gt;</span>
                  </label>
                  <div className="flex items-center border border-line-strong bg-black/40 px-3.5 py-3 font-mono text-base tracking-[0.3em]">
                    <input
                      ref={inputRef}
                      type="password"
                      className="min-w-0 flex-1 bg-transparent font-mono text-base tracking-[0.3em] text-accent"
                      value={pwd}
                      onChange={(e) => {
                        setPwd(e.target.value);
                        SoundManager.type();
                      }}
                      disabled={phase !== 'prompt'}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Caret />
                  </div>
                  <div className="mt-3 min-h-4 font-mono text-[11px] tracking-[0.02em] text-fg-dim">
                    {phase === 'verify' && (
                      <DecodeText text="// verifying biometric handshake …" speed={18} />
                    )}
                    {phase === 'ok' && (
                      <span className="text-accent">// access granted · loading vessel state</span>
                    )}
                    {phase === 'prompt' && (
                      <span>
                        hint: try <span className="text-accent">journs</span> · prototype passphrase
                      </span>
                    )}
                  </div>
                  <div className="mt-[18px] flex flex-wrap gap-2.5">
                    <Btn type="submit" variant="primary" disabled={phase !== 'prompt' || !pwd}>
                      ▸ AUTHENTICATE
                    </Btn>
                    <Btn variant="ghost" onClick={() => setPwd('')}>
                      CLEAR
                    </Btn>
                  </div>
                </form>
              )}
            </div>
          </Panel>
          <div className="login-connectors connector" style={{ left: -100, top: 80, width: 100 }} />
          <div className="login-connectors connector" style={{ left: -60, bottom: 60, width: 60 }} />
        </div>
      </div>
    </div>
  );
}

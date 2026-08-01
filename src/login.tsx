import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { SoundManager, DecodeText, Bracket, Panel, Btn, Caret } from './hud';
import {
  generateRecoveryPhrase,
  recoverAccount,
  registerAccount,
  unlockAccount,
  type AuthSession,
} from './identity';
import type { DeviceIdentity } from './types';

const TYPED_BOOT_LINES = [
  '$ journs.init --e2ee',
  '> resolve MongoDB Atlas · TLS 1.3 OK',
  '> vercel host · /api routes ready',
  '> dek envelope · aes-gcm standby',
  '> awaiting operator credentials',
];

type BootPhase = 'boot' | 'ready';
type Mode =
  | 'choose'
  | 'unlock'
  | 'create-phrase'
  | 'create-verify'
  | 'create-pass'
  | 'recover-phrase'
  | 'recover-pass';

/**
 * Write to the clipboard, falling back to a detached textarea + execCommand.
 * `navigator.clipboard` is undefined on insecure origins, which includes the
 * dev server whenever it is reached over a LAN IP rather than localhost.
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Falls through to the legacy path below.
  }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);

  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

/** Pick `count` distinct word indices (1-based display uses +1) from a 12-word phrase. */
function pickVerifySlots(count = 3): number[] {
  const idx = Array.from({ length: 12 }, (_, i) => i);

  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = a;
  }

  return idx.slice(0, count).sort((a, b) => a - b);
}

/** Secure terminal: unlock, create ID, or recover with 12 words. */
export function LoginScreen({
  onAuth,
  identity,
  syncError,
}: {
  onAuth: (
    session: AuthSession,
    options?: { isNewUser?: boolean },
  ) => void | Promise<void>;
  identity: DeviceIdentity | null;
  syncError?: string | null;
}) {
  const [boot, setBoot] = useState<BootPhase>('boot');
  const [bootIdx, setBootIdx] = useState(0);
  const [mode, setMode] = useState<Mode>(() => (identity ? 'unlock' : 'choose'));
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string[]>([]);
  const [recoverWords, setRecoverWords] = useState<string[]>(() => Array(12).fill(''));
  const [savedOk, setSavedOk] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [verifySlots, setVerifySlots] = useState<number[]>([]);
  const [verifyAnswers, setVerifyAnswers] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (boot !== 'boot') {
      return;
    }

    let i = 0;
    const id = setInterval(() => {
      i++;
      setBootIdx(i);

      if (i >= TYPED_BOOT_LINES.length) {
        clearInterval(id);
        setTimeout(() => {
          setBoot('ready');
          setTimeout(() => inputRef.current?.focus(), 50);
        }, 400);
      }
    }, 420);

    return () => clearInterval(id);
  }, [boot]);

  /** Flash deny animation and clear password fields. */
  const deny = (msg: string) => {
    SoundManager.deny();
    setShake(true);
    setStatus(msg);
    setTimeout(() => setShake(false), 500);
    setPwd('');
    setPwd2('');
  };

  /** Unlock with device passphrase. */
  const submitUnlock = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!identity || busy || !pwd) {
      return;
    }

    setBusy(true);
    setStatus('// verifying device lock …');
    SoundManager.click();

    try {
      const session = await unlockAccount(identity, pwd);
      SoundManager.confirm();
      setStatus('// access granted · syncing encrypted archive');
      await onAuth(session);
    } catch (err) {
      deny(err instanceof Error ? `// ${err.message}` : '// verify failed');
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  useEffect(() => {
    if (!copied) {
      return;
    }

    const t = setTimeout(() => {
      setCopied(null);
    }, 2000);

    return () => {
      clearTimeout(t);
    };
  }, [copied]);

  /** Copy the mnemonic as plain space-separated words, importable elsewhere. */
  const copyPhrase = async () => {
    setCopied((await writeClipboard(phrase.join(' '))) ? 'ok' : 'fail');
  };

  /** Roll a fresh mnemonic · the old one is discarded and never persisted. */
  const rerollPhrase = () => {
    setPhrase(generateRecoveryPhrase());
    setCopied(null);
    setSavedOk(false);
  };

  /** Begin create-ID flow with a fresh 12-word phrase. */
  const startCreate = () => {
    SoundManager.click();
    setPhrase(generateRecoveryPhrase());
    setCopied(null);
    setSavedOk(false);
    setVerifySlots([]);
    setVerifyAnswers([]);
    setPwd('');
    setPwd2('');
    setStatus(null);
    setMode('create-phrase');
  };

  /** Advance from phrase save → 3-word verification challenge. */
  const confirmPhraseSaved = () => {
    if (!savedOk) {
      return;
    }

    SoundManager.click();
    const slots = pickVerifySlots(3);
    setVerifySlots(slots);
    setVerifyAnswers(slots.map(() => ''));
    setStatus(null);
    setMode('create-verify');
  };

  /** Check the three recovery words, then advance to passphrase setup. */
  const submitPhraseVerify = (e?: FormEvent) => {
    e?.preventDefault();

    const ok = verifySlots.every((slot, i) => {
      const expected = phrase[slot]?.toLowerCase() ?? '';
      const got = (verifyAnswers[i] ?? '').trim().toLowerCase();

      return expected.length > 0 && got === expected;
    });

    if (!ok) {
      deny('// verification failed · check word positions');
      const slots = pickVerifySlots(3);
      setVerifySlots(slots);
      setVerifyAnswers(slots.map(() => ''));

      return;
    }

    SoundManager.confirm();
    setStatus(null);
    setMode('create-pass');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /** Persist new identity after passphrase confirm. */
  const submitCreatePass = async (e?: FormEvent) => {
    e?.preventDefault();

    if (busy) {
      return;
    }

    if (pwd.trim().length < 4) {
      deny('// passphrase must be ≥ 4 chars');

      return;
    }

    if (pwd !== pwd2) {
      deny('// passphrases do not match');

      return;
    }

    setBusy(true);
    setStatus('// registering on Atlas · sealing E2EE envelope');
    SoundManager.click();

    try {
      const session = await registerAccount(phrase, pwd);
      SoundManager.confirm();
      setStatus('// identity sealed · syncing ciphertext archive');
      await onAuth(session, { isNewUser: true });
    } catch (err) {
      deny(err instanceof Error ? `// ${err.message}` : '// create failed');
      setBusy(false);
    }
  };

  /** Open recover / new-device phrase entry. */
  const startRecover = () => {
    SoundManager.click();
    setRecoverWords(Array(12).fill(''));
    setPwd('');
    setPwd2('');
    setStatus(null);
    setMode('recover-phrase');
  };

  /** Paste space-separated phrase into the 12 slots. */
  const onPastePhrase = (text: string) => {
    const parts = text.trim().toLowerCase().split(/\s+/).slice(0, 12);
    const next = Array(12).fill('') as string[];

    parts.forEach((w, i) => {
      next[i] = w;
    });

    setRecoverWords(next);
  };

  /** Advance recover phrase → set new device passphrase. */
  const confirmRecoverPhrase = () => {
    if (recoverWords.some((w) => !w.trim())) {
      deny('// enter all 12 recovery words');

      return;
    }

    SoundManager.click();
    setStatus(null);
    setMode('recover-pass');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /** Complete recover by setting a new device passphrase. */
  const submitRecoverPass = async (e?: FormEvent) => {
    e?.preventDefault();

    if (busy) {
      return;
    }

    if (pwd.trim().length < 4) {
      deny('// passphrase must be ≥ 4 chars');

      return;
    }

    if (pwd !== pwd2) {
      deny('// passphrases do not match');

      return;
    }

    setBusy(true);
    setStatus('// verifying recovery phrase …');
    SoundManager.click();

    try {
      const session = await recoverAccount(recoverWords, pwd);
      SoundManager.confirm();
      setStatus('// device lock reset · access granted');
      await onAuth(session);
    } catch (err) {
      deny(err instanceof Error ? `// ${err.message}` : '// recover failed');
      setBusy(false);
    }
  };

  const callsign = identity?.operatorId ?? 'UNBOUND';

  return (
    <div className="relative grid min-h-full place-items-center px-4 py-8 max-phone:py-6 laptop:px-[6vw] laptop:py-10">
      <div className="grid w-full max-w-245 grid-cols-1 items-stretch gap-8 max-tablet:gap-6 tablet:grid-cols-[minmax(0,320px)_1fr] tablet:gap-10 laptop:gap-15">
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
              <span className="font-mono tracking-[0.02em] text-fg-dim">
                {identity ? '// BOUND' : '// NO LOCAL ID'}
              </span>
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
                  E2EE
                </text>
                <text x="14" y="194" fill="var(--fg-mute)" fontFamily="JetBrains Mono" fontSize="8">
                  ATLAS
                </text>
                <text x="148" y="194" fill="var(--accent)" fontFamily="JetBrains Mono" fontSize="8">
                  ·VERCEL
                </text>
              </svg>
            </div>
            <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px]">
              {(
                [
                  ['CALLSIGN', callsign, false],
                  ['HOST', 'VERCEL · ATLAS', false],
                  ['CIPHER', 'AES-GCM · DEK', false],
                  ['RECOVERY', identity ? 'CONFIRMED' : 'UNSET', true],
                  ['STORE', 'ciphertext only', false],
                ] as const
              ).map(([lbl, val, accent]) => (
                <div key={lbl} className="flex justify-between gap-3">
                  <span className="tracking-[0.16em] text-fg-mute">{lbl}</span>
                  <span className={`truncate ${accent ? 'text-accent' : 'text-fg'}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </Bracket>

        <div
          className={`relative min-w-0 tablet:transform-[perspective(1400px)_rotateY(-2deg)] ${shake ? 'animate-shake' : ''}`}
        >
          <Panel title={<DecodeText text="SECURE TERMINAL" />} meta="auth · e2ee · atlas">
            <div className="flex min-h-70 flex-col gap-4.5 max-phone:min-h-60">
              <div className="font-mono text-xs leading-[1.8]">
                {TYPED_BOOT_LINES.slice(0, bootIdx).map((l, i) => (
                  <div key={i} className={i === 0 ? 'text-fg' : 'text-fg-dim'}>
                    <DecodeText text={l} speed={12} />
                  </div>
                ))}
                {boot === 'boot' && bootIdx < TYPED_BOOT_LINES.length && (
                  <div>
                    <Caret />
                  </div>
                )}
              </div>

              {boot === 'ready' && syncError && (
                <div className="font-mono text-[11px] tracking-[0.02em] text-accent">
                  // sync error · {syncError}
                </div>
              )}

              {boot === 'ready' && mode === 'choose' && (
                <div className="flex flex-col gap-3">
                  <p className="font-mono text-[11px] tracking-[0.02em] text-fg-dim">
                    // no local session · create a new user on Atlas or recover with 12 words
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <Btn variant="primary" onClick={startCreate}>
                      ▸ CREATE NEW USER
                    </Btn>
                    <Btn variant="ghost" onClick={startRecover}>
                      RECOVER / NEW DEVICE
                    </Btn>
                  </div>
                </div>
              )}

              {boot === 'ready' && mode === 'unlock' && identity && (
                <form onSubmit={submitUnlock}>
                  <label className="mb-2 block text-xs">
                    <span className="font-mono tracking-[0.02em] text-accent">operator@journs</span>
                    <span className="font-mono tracking-[0.02em] text-fg-dim"> :~$ </span>
                    <span className="font-mono tracking-[0.02em]">device lock &gt;</span>
                  </label>
                  <div className="flex items-center border border-line-strong bg-black/40 px-3.5 py-3 font-mono text-base tracking-[0.3em]">
                    <input
                      ref={inputRef}
                      type="password"
                      className="min-w-0 flex-1 bg-transparent font-mono text-base tracking-[0.3em] text-accent"
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      onKeyDown={() => SoundManager.type()}
                      disabled={busy}
                      autoComplete="current-password"
                      spellCheck={false}
                    />
                    <Caret />
                  </div>
                  <div className="mt-3 min-h-4 font-mono text-[11px] tracking-[0.02em] text-fg-dim">
                    {status ? (
                      <span className={status.includes('granted') ? 'text-accent' : undefined}>
                        {status}
                      </span>
                    ) : (
                      <span>// passphrase unlocks DEK · then sync ciphertext</span>
                    )}
                  </div>
                  <div className="mt-4.5 flex flex-wrap gap-2.5">
                    <Btn type="submit" variant="primary" disabled={busy || !pwd}>
                      ▸ UNLOCK
                    </Btn>
                    <Btn
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setPwd('');
                        setStatus(null);
                        startCreate();
                      }}
                    >
                      CREATE NEW USER
                    </Btn>
                    <Btn
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setPwd('');
                        setStatus(null);
                        startRecover();
                      }}
                    >
                      RECOVER / NEW DEVICE
                    </Btn>
                  </div>
                </form>
              )}

              {boot === 'ready' && mode === 'create-phrase' && (
                <div className="flex flex-col gap-3.5">
                  <p className="font-mono text-[11px] tracking-[0.02em] text-fg-dim">
                    // write down these 12 BIP39 words · they unwrap your DEK · never leave this device
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <span className="font-mono text-[10px] tracking-[0.14em] text-fg-mute">
                      RECOVERY PHRASE · 12 WORDS
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Btn variant="ghost" onClick={rerollPhrase} title="Generate a different phrase">
                        ⟳ REROLL
                      </Btn>
                      <Btn variant="ghost" onClick={copyPhrase}>
                        {copied === 'ok' ? '✓ COPIED' : copied === 'fail' ? 'COPY FAILED' : 'COPY ALL'}
                      </Btn>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 phone:grid-cols-3">
                    {phrase.map((w, i) => (
                      <div
                        key={`${w}-${i}`}
                        className="flex items-center gap-2 border border-line bg-black/30 px-2.5 py-2 font-mono text-[12px]"
                      >
                        <span className="text-fg-mute">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-accent">{w}</span>
                      </div>
                    ))}
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 font-mono text-[11px] text-fg-dim">
                    <input
                      type="checkbox"
                      checked={savedOk}
                      onChange={(e) => setSavedOk(e.target.checked)}
                      className="size-4 accent-(--accent)"
                    />
                    I saved these words offline
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    <Btn variant="primary" disabled={!savedOk} onClick={confirmPhraseSaved}>
                      ▸ CONTINUE
                    </Btn>
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        setMode(identity ? 'unlock' : 'choose');
                        setPhrase([]);
                        setCopied(null);
                        setSavedOk(false);
                      }}
                    >
                      BACK
                    </Btn>
                  </div>
                </div>
              )}

              {boot === 'ready' && mode === 'create-verify' && (
                <form onSubmit={submitPhraseVerify} className="flex flex-col gap-3.5">
                  <p className="font-mono text-[11px] tracking-[0.02em] text-fg-dim">
                    // confirm 3 words from your recovery phrase
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {verifySlots.map((slot, i) => (
                      <label key={slot} className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] tracking-[0.14em] text-fg-mute">
                          WORD {String(slot + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          className="border border-line-strong bg-black/40 px-3.5 py-3 font-mono text-[13px] tracking-[0.08em] text-accent max-tablet:min-h-11"
                          value={verifyAnswers[i] ?? ''}
                          autoFocus={i === 0}
                          spellCheck={false}
                          autoComplete="off"
                          autoCapitalize="off"
                          onChange={(e) => {
                            const next = [...verifyAnswers];
                            next[i] = e.target.value.toLowerCase().replace(/\s+/g, '');
                            setVerifyAnswers(next);
                          }}
                          onKeyDown={() => SoundManager.type()}
                        />
                      </label>
                    ))}
                  </div>
                  <StatusLine status={status} />
                  <div className="flex flex-wrap gap-2.5">
                    <Btn
                      type="submit"
                      variant="primary"
                      disabled={verifyAnswers.some((w) => !w.trim())}
                    >
                      ▸ VERIFY WORDS
                    </Btn>
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        setMode('create-phrase');
                        setStatus(null);
                        setVerifyAnswers([]);
                      }}
                    >
                      BACK
                    </Btn>
                  </div>
                </form>
              )}

              {boot === 'ready' && mode === 'create-pass' && (
                <form onSubmit={submitCreatePass} className="flex flex-col gap-3">
                  <p className="font-mono text-[11px] tracking-[0.02em] text-fg-dim">
                    // set a device passphrase · wraps DEK · authenticates to Atlas
                  </p>
                  <PassFields
                    inputRef={inputRef}
                    pwd={pwd}
                    pwd2={pwd2}
                    setPwd={setPwd}
                    setPwd2={setPwd2}
                    disabled={busy}
                  />
                  <StatusLine status={status} />
                  <div className="flex flex-wrap gap-2.5">
                    <Btn type="submit" variant="primary" disabled={busy || !pwd || !pwd2}>
                      ▸ SEAL IDENTITY
                    </Btn>
                    <Btn
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setMode('create-verify');
                        setPwd('');
                        setPwd2('');
                        const slots = pickVerifySlots(3);
                        setVerifySlots(slots);
                        setVerifyAnswers(slots.map(() => ''));
                      }}
                    >
                      BACK
                    </Btn>
                  </div>
                </form>
              )}

              {boot === 'ready' && mode === 'recover-phrase' && (
                <div className="flex flex-col gap-3.5">
                  <p className="font-mono text-[11px] tracking-[0.02em] text-fg-dim">
                    // new device · enter 12 words to unwrap DEK from Atlas
                  </p>
                  <input
                    type="text"
                    className="border border-line bg-black/30 px-3 py-2.5 font-mono text-[12px] text-fg placeholder:text-fg-mute max-tablet:min-h-11"
                    placeholder="PASTE FULL PHRASE (OPTIONAL)"
                    onChange={(e) => {
                      if (e.target.value.includes(' ')) {
                        onPastePhrase(e.target.value);
                      }
                    }}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <div className="grid grid-cols-2 gap-2 phone:grid-cols-3">
                    {recoverWords.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 border border-line bg-black/30 px-2 py-1.5"
                      >
                        <span className="shrink-0 font-mono text-[10px] text-fg-mute">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-accent max-tablet:min-h-9"
                          value={w}
                          onChange={(e) => {
                            const next = [...recoverWords];
                            next[i] = e.target.value.toLowerCase().replace(/\s+/g, '');
                            setRecoverWords(next);
                          }}
                          onKeyDown={() => SoundManager.type()}
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </div>
                    ))}
                  </div>
                  <StatusLine status={status} />
                  <div className="flex flex-wrap gap-2.5">
                    <Btn variant="primary" onClick={confirmRecoverPhrase}>
                      ▸ CONTINUE
                    </Btn>
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        setMode(identity ? 'unlock' : 'choose');
                        setStatus(null);
                      }}
                    >
                      BACK
                    </Btn>
                  </div>
                </div>
              )}

              {boot === 'ready' && mode === 'recover-pass' && (
                <form onSubmit={submitRecoverPass} className="flex flex-col gap-3">
                  <p className="font-mono text-[11px] tracking-[0.02em] text-fg-dim">
                    // set a new device passphrase · rewraps DEK on Atlas
                  </p>
                  <PassFields
                    inputRef={inputRef}
                    pwd={pwd}
                    pwd2={pwd2}
                    setPwd={setPwd}
                    setPwd2={setPwd2}
                    disabled={busy}
                  />
                  <StatusLine status={status} />
                  <div className="flex flex-wrap gap-2.5">
                    <Btn type="submit" variant="primary" disabled={busy || !pwd || !pwd2}>
                      ▸ RESET DEVICE LOCK
                    </Btn>
                    <Btn
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setMode('recover-phrase');
                        setPwd('');
                        setPwd2('');
                      }}
                    >
                      BACK
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

/** Dual passphrase inputs for create / recover setup. */
function PassFields({
  inputRef,
  pwd,
  pwd2,
  setPwd,
  setPwd2,
  disabled,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  pwd: string;
  pwd2: string;
  setPwd: (v: string) => void;
  setPwd2: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="flex items-center border border-line-strong bg-black/40 px-3.5 py-3 font-mono text-base tracking-[0.3em]">
        <input
          ref={inputRef}
          type="password"
          className="min-w-0 flex-1 bg-transparent font-mono text-base tracking-[0.3em] text-accent"
          value={pwd}
          placeholder="PASS"
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={() => SoundManager.type()}
          disabled={disabled}
          autoComplete="new-password"
          spellCheck={false}
        />
      </div>
      <div className="flex items-center border border-line-strong bg-black/40 px-3.5 py-3 font-mono text-base tracking-[0.3em]">
        <input
          type="password"
          className="min-w-0 flex-1 bg-transparent font-mono text-base tracking-[0.3em] text-accent"
          value={pwd2}
          placeholder="CONFIRM"
          onChange={(e) => setPwd2(e.target.value)}
          onKeyDown={() => SoundManager.type()}
          disabled={disabled}
          autoComplete="new-password"
          spellCheck={false}
        />
      </div>
    </>
  );
}

/** Compact status / error line under forms. */
function StatusLine({ status }: { status: string | null }) {
  if (!status) {
    return <div className="min-h-4" />;
  }

  const ok =
    status.includes('granted') ||
    status.includes('sealed') ||
    status.includes('registering') ||
    status.includes('forging');

  return (
    <div className="min-h-4 font-mono text-[11px] tracking-[0.02em] text-fg-dim">
      <span className={ok ? 'text-accent' : undefined}>{status}</span>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SoundManager, DecodeText, Bracket, Panel, Btn } from './hud';

const PASSPHRASE = 'meridian'; // demo passphrase — display in hint
const TYPED_BOOT_LINES = [
  '$ meridian.init --secure',
  '> binding to cluster ATL-07.mongodb.local:27017',
  '> handshake … TLS 1.3 OK',
  '> integrity check … sha256 OK',
  '> awaiting operator passphrase',
];

type LoginPhase = 'boot' | 'prompt' | 'verify' | 'ok' | 'fail';

export function LoginScreen({ onAuth }: { onAuth: (user: string) => void }) {
  const [phase, setPhase] = useState<LoginPhase>('boot');
  const [pwd, setPwd] = useState('');
  const [bootIdx, setBootIdx] = useState(0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase !== 'boot') return;
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

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (phase === 'verify') return;
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
    <div className="login-wrap">
      <div className="login-grid">
        <Bracket className="login-id">
          <div className="id-card">
            <div className="id-row id-row-top">
              <span className="cap dim">OPERATOR ID</span>
              <span className="mono dim">// CL-A · CLEARED</span>
            </div>
            <div className="id-portrait">
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
            <div className="id-row id-table">
              <div>
                <span className="lbl">CALLSIGN</span>
                <span className="val">OPERATOR · 01</span>
              </div>
              <div>
                <span className="lbl">VESSEL</span>
                <span className="val">MERIDIAN-01</span>
              </div>
              <div>
                <span className="lbl">ROLE</span>
                <span className="val">SOLE AUTHOR</span>
              </div>
              <div>
                <span className="lbl">CLEARANCE</span>
                <span className="val acc">CRUD · ALL</span>
              </div>
              <div>
                <span className="lbl">BOUND</span>
                <span className="val">mongodb://meridian.atl-07</span>
              </div>
            </div>
          </div>
        </Bracket>

        <div className={`login-terminal ${shake ? 'shake' : ''}`}>
          <Panel title={<DecodeText text="SECURE TERMINAL" />} meta="tty/01 · 9600 8N1">
            <div className="terminal-body">
              <div className="boot">
                {TYPED_BOOT_LINES.slice(0, bootIdx).map((l, i) => (
                  <div key={i} className="boot-line">
                    <DecodeText text={l} speed={12} />
                  </div>
                ))}
                {phase === 'boot' && bootIdx < TYPED_BOOT_LINES.length && (
                  <div className="boot-line">
                    <span className="caret" />
                  </div>
                )}
              </div>
              {phase !== 'boot' && (
                <form onSubmit={submit} className="prompt-form">
                  <label className="prompt-label">
                    <span className="acc mono">operator@meridian</span>
                    <span className="dim mono"> :~$ </span>
                    <span className="mono">passphrase &gt;</span>
                  </label>
                  <div className="prompt-input">
                    <input
                      ref={inputRef}
                      type="password"
                      value={pwd}
                      onChange={(e) => {
                        setPwd(e.target.value);
                        SoundManager.type();
                      }}
                      disabled={phase !== 'prompt'}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <span className="caret" />
                  </div>
                  <div className="prompt-msg mono dim">
                    {phase === 'verify' && (
                      <DecodeText text="// verifying biometric handshake …" speed={18} />
                    )}
                    {phase === 'ok' && (
                      <span className="acc">// access granted · loading vessel state</span>
                    )}
                    {phase === 'prompt' && (
                      <span>
                        hint: try <span className="acc">meridian</span> · prototype passphrase
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
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
          <div className="connector" style={{ left: -100, top: 80, width: 100 }} />
          <div className="connector" style={{ left: -60, bottom: 60, width: 60 }} />
        </div>
      </div>
      <style>{`
        .login-wrap {
          min-height: 100%;
          display: grid;
          place-items: center;
          padding: 40px 6vw;
          position: relative;
        }
        .login-grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 60px;
          max-width: 980px;
          width: 100%;
          align-items: stretch;
        }
        .login-id .id-card {
          background: linear-gradient(180deg, var(--bg-1), var(--bg));
          border: 1px solid var(--line-strong);
          padding: 16px;
          display: flex; flex-direction: column; gap: 14px;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.4),
            0 14px 30px rgba(0,0,0,0.5);
        }
        .id-row { display: flex; justify-content: space-between; align-items: center; }
        .id-row-top { font-size: 10px; }
        .id-portrait {
          aspect-ratio: 1; border: 1px solid var(--line-strong);
          background: var(--bg);
          position: relative;
        }
        .id-table { display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 10px; font-family: var(--mono); }
        .id-table > div { display: flex; justify-content: space-between; gap: 12px; }
        .id-table .lbl { color: var(--fg-mute); letter-spacing: 0.16em; }
        .id-table .val { color: var(--fg); }
        .login-terminal { position: relative; transform: perspective(1400px) rotateY(-2deg); transform-style: preserve-3d; }
        .login-terminal.shake { animation: shake 0.4s; }
        @keyframes shake {
          0%, 100% { transform: perspective(1400px) rotateY(-2deg) translateX(0); }
          25% { transform: perspective(1400px) rotateY(-2deg) translateX(-6px); }
          75% { transform: perspective(1400px) rotateY(-2deg) translateX(6px); }
        }
        .terminal-body { min-height: 320px; display: flex; flex-direction: column; gap: 18px; }
        .boot { font-family: var(--mono); font-size: 12px; line-height: 1.8; }
        .boot-line { color: var(--fg-dim); }
        .boot-line:first-child { color: var(--fg); }
        .prompt-label { display: block; font-size: 12px; margin-bottom: 8px; }
        .prompt-input {
          display: flex; align-items: center;
          padding: 12px 14px;
          background: rgba(0,0,0,0.4);
          border: 1px solid var(--line-strong);
          font-family: var(--mono);
          font-size: 16px;
          letter-spacing: 0.3em;
        }
        .prompt-input input {
          flex: 1; min-width: 0;
          background: transparent;
          color: var(--accent);
          font-family: var(--mono);
          font-size: 16px;
          letter-spacing: 0.3em;
        }
        .prompt-input input::placeholder { color: var(--fg-mute); }
        .prompt-msg { font-size: 11px; margin-top: 12px; min-height: 16px; }
      `}</style>
    </div>
  );
}

import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { playDtmf, playPoltergeistAlert } from "../lib/sound";
import type { UssdApp, UssdFrame } from "../lib/types";

/** Generic fraud words in a frame body trigger the Poltergeist alert (no app-specific text). */
const ALERT_PATTERN = /\b(ALERT|COUNTERFEIT|TAMPERED|FRAUD)\b/i;
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

interface Props {
  app: UssdApp;
  frame: UssdFrame | null;
  busy: boolean;
  lastActivity: number;
  error: string | null;
  idleMessage: string | null;
  soundOn: boolean;
  hauntedCrt: boolean;
  /** Incremented by the page on every call or SIM switch: the handset gets possessed for a moment. */
  poltergeistTick: number;
  onDial: (composed: string) => void;
  onSend: (input: string) => void;
  onHangUp: () => void;
}

const KEYS: Array<[string, string]> = [
  ["1", "oo"],
  ["2", "abc"],
  ["3", "def"],
  ["4", "ghi"],
  ["5", "jkl"],
  ["6", "mno"],
  ["7", "pqrs"],
  ["8", "tuv"],
  ["9", "wxyz"],
  ["*", "+"],
  ["0", "space"],
  ["#", "ussd"],
];

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function SignalBars() {
  return (
    <span className="flex items-end gap-[2px]" aria-label="2G signal">
      {[4, 7, 10, 13].map((h, i) => (
        <span
          key={h}
          className="w-[3px] rounded-xs"
          style={{
            height: h,
            background: i < 3 ? "var(--screen-text)" : "color-mix(in srgb, var(--screen-text) 28%, transparent)",
          }}
        />
      ))}
    </span>
  );
}

function Battery() {
  return (
    <span className="flex items-center" aria-label="battery">
      <span className="relative h-[9px] w-[18px] rounded-[2px] border border-[var(--screen-text)] p-[1px]">
        <span className="block h-full w-[78%] bg-[var(--screen-text)]" />
      </span>
      <span className="h-[4px] w-[2px] bg-[var(--screen-text)]" />
    </span>
  );
}

export function RetroPhone({
  app,
  frame,
  busy,
  lastActivity,
  error,
  idleMessage,
  soundOn,
  hauntedCrt,
  poltergeistTick,
  onDial,
  onSend,
  onHangUp,
}: Props) {
  const [entry, setEntry] = useState("");
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [degauss, setDegauss] = useState(false);
  const [surge, setSurge] = useState(false);
  const [alert, setAlert] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const levitateRef = useRef<HTMLDivElement>(null);
  const possessRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const tiltTo = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc } | null>(null);
  const inSession = frame?.prefix === "CON";
  const now = useNow(inSession);
  const nav = app.navigation;
  const remaining = inSession ? Math.max(0, nav.sessionTimeoutSec - Math.floor((now - lastActivity) / 1000)) : 0;
  const hasMorePages = !!frame && frame.page_index < frame.total_pages - 1;

  useEffect(() => setEntry(""), [frame, app.id]);

  // Trigger brief CRT degauss pulse when switching SIM or receiving a new frame
  useEffect(() => {
    setDegauss(true);
    const timer = window.setTimeout(() => setDegauss(false), 320);
    return () => window.clearTimeout(timer);
  }, [app.id, frame?.raw_response]);

  // Idle levitation (float + breathing ground shadow) and the magnetic mouse tilt.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        levitateRef.current,
        { y: 7, rotationZ: -1, rotationX: 2 },
        { y: -7, rotationZ: 1, rotationX: 2, duration: 2.7, ease: "sine.inOut", yoyo: true, repeat: -1 },
      );
      gsap.fromTo(
        shadowRef.current,
        { scaleX: 1, opacity: 0.8 },
        { scaleX: 0.8, opacity: 0.45, duration: 2.7, ease: "sine.inOut", yoyo: true, repeat: -1 },
      );
      tiltTo.current = {
        x: gsap.quickTo(tiltRef.current, "rotationX", { duration: 0.6, ease: "power3.out" }),
        y: gsap.quickTo(tiltRef.current, "rotationY", { duration: 0.6, ease: "power3.out" }),
      };
      return () => {
        tiltTo.current = null;
      };
    });
    return () => mm.revert();
  }, []);

  const onStageMove = (event: PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!tiltTo.current || !stage || event.pointerType === "touch") return;
    const rect = stage.getBoundingClientRect();
    const px = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) - 0.5;
    const py = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1) - 0.5;
    tiltTo.current.y(px * 28); // rotateY ±14°
    tiltTo.current.x(-py * 22); // rotateX ±11°
    gsap.to(glareRef.current, { "--gx": `${(px + 0.5) * 100}%`, "--gy": `${(py + 0.5) * 100}%`, duration: 0.4 });
  };

  const onStageLeave = () => {
    tiltTo.current?.x(0);
    tiltTo.current?.y(0);
  };

  const possess = (strength: number) => {
    setSurge(true);
    window.setTimeout(() => setSurge(false), 1100);
    if (!window.matchMedia(MOTION_OK).matches) return;
    const s = strength;
    gsap.killTweensOf(possessRef.current);
    gsap.to(possessRef.current, {
      keyframes: [
        { x: -8 * s, y: 3 * s, rotationZ: -3 * s, rotationY: 9 * s, duration: 0.05 },
        { x: 9 * s, y: -4 * s, rotationZ: 3 * s, rotationY: -11 * s, duration: 0.05 },
        { x: -6 * s, y: 2 * s, rotationZ: -2 * s, rotationY: 6 * s, duration: 0.05 },
        { x: 5 * s, y: -2 * s, rotationZ: 2 * s, rotationY: -4 * s, duration: 0.06 },
        { x: -2 * s, y: 1 * s, rotationZ: -1 * s, rotationY: 2 * s, duration: 0.07 },
        { x: 0, y: 0, rotationZ: 0, rotationY: 0, duration: 0.12, ease: "power2.out" },
      ],
    });
  };

  // Calls and SIM switches possess the handset.
  useEffect(() => {
    if (poltergeistTick > 0) possess(1);
  }, [poltergeistTick]);

  // A counterfeit or tampered verdict: stronger shake, red screen flash and a haunted organ chord.
  useEffect(() => {
    if (!frame || !ALERT_PATTERN.test(frame.body)) return;
    possess(1.6);
    playPoltergeistAlert(soundOn);
    setAlert(true);
    const timer = window.setTimeout(() => setAlert(false), 1500);
    return () => window.clearTimeout(timer);
    // soundOn is read at alert time only: toggling sound must not replay the alert.
  }, [frame?.raw_response]);

  const flashKey = (key: string) => {
    playDtmf(key, soundOn);
    setPressedKey(key);
    window.setTimeout(() => setPressedKey((curr) => (curr === key ? null : curr)), 150);
  };

  // Physical keyboard typing routes directly to the phone when no external form control is focused
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target !== inputRef.current && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (/^[0-9*#]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        flashKey(event.key);
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    if (inSession) {
      onSend(entry.trim());
    } else {
      onDial(entry.trim() || app.shortcode);
    }
  };

  const press = (key: string) => {
    flashKey(key);
    setEntry((value) => value + key);
    inputRef.current?.focus();
  };

  const sendKey = (key: string) => {
    flashKey(key[0] ?? "0");
    if (inSession && !busy) onSend(key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onHangUp();
    }
  };

  const charRatio = frame ? frame.char_count / frame.max_chars : 0;
  const transmitting = busy || inSession;

  return (
    <div
      id="phone-stage"
      ref={stageRef}
      onPointerMove={onStageMove}
      onPointerLeave={onStageLeave}
      className="phone-stage mx-auto w-full max-w-[356px] select-none"
    >
      <div className={`phone-aura ${surge ? "phone-aura-surge" : ""}`} aria-hidden />
      <div ref={levitateRef} className="phone-3d">
        <div ref={possessRef} className="phone-3d">
          <div ref={tiltRef} className="handset-wrap phone-3d">
            {/* External 2G GSM Antenna with pulsing spectral rings */}
            <div className="antenna-stub" aria-hidden>
              <span className="antenna-tip" />
              <span className={`antenna-ring ${transmitting || surge ? "antenna-ring-active" : ""}`} />
              <span className={`antenna-ring ${transmitting || surge ? "antenna-ring-active-delayed" : ""}`} />
            </div>

            <div className="bezel rounded-[3rem] px-5 pb-6 pt-4">
              <div ref={glareRef} className="phone-glare" aria-hidden />
              {/* Top screws + carved speaker slots + model crest */}
              <div className="mb-2.5 flex items-center justify-between px-2">
                <span className="screw" aria-hidden />
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1" aria-hidden>
                    {[0, 1, 2, 3, 4, 5, 6].map((slot) => (
                      <span
                        key={slot}
                        className={`rounded-full bg-black/80 shadow-inner ${slot === 3 ? "h-1.5 w-3" : "h-1 w-1.5"}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="led-2g inline-block h-1.5 w-1.5 rounded-full" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                      GHOST//SIGNAL · 2G
                    </span>
                  </div>
                </div>
                <span className="screw" aria-hidden />
              </div>

              {/* Recessed lens & Dot-Matrix CRT LCD */}
              <div className={`lcd-frame depth-screen rounded-[1.45rem] p-2 ${alert ? "lcd-alert" : ""}`}>
                <div
                  className={`lcd rounded-2xl px-3.5 pb-2.5 pt-2 ${hauntedCrt ? "lcd-haunted" : ""} ${
                    degauss ? "crt-degauss" : ""
                  }`}
                >
                  {/* Nokia 2G Top Status Bar */}
                  <div className="flex items-center justify-between text-[14px] leading-none opacity-90 tabular-nums">
                    <span className="flex items-center gap-1.5">
                      <SignalBars />
                      <span>2G·SS7 👻</span>
                    </span>
                    <span className="uppercase tracking-wider">{app.theme.badgeLabel}</span>
                    <span className="flex items-center gap-2">
                      {inSession && <span aria-label="session countdown">{remaining}s</span>}
                      <Battery />
                    </span>
                  </div>

                  {/* Shortcode & CON/END byte counter */}
                  <div className="mt-1.5 flex items-center justify-between border-y border-[color-mix(in_srgb,var(--screen-text)_25%,transparent)] py-1 text-[15px] leading-none tabular-nums">
                    <span>USSD {app.shortcode}</span>
                    {frame ? (
                      <span className="flex items-center gap-1.5">
                        <span className="rounded-xs bg-[var(--screen-text)] px-1 font-bold text-[var(--screen-bg)]">
                          {frame.prefix}
                        </span>
                        <span className={charRatio > 1 ? "text-rose-400" : undefined}>
                          {frame.char_count}/{frame.max_chars}
                        </span>
                      </span>
                    ) : (
                      <span>READY</span>
                    )}
                  </div>

                  {/* Main USSD Frame Screen */}
                  <div className="h-[212px] overflow-y-auto py-2 text-[21px] leading-[1.08]" aria-live="polite">
                    {busy && !frame ? (
                      <p className="animate-pulse">Sending USSD...</p>
                    ) : frame ? (
                      <pre className="whitespace-pre-wrap break-words font-[inherit]">{frame.body}</pre>
                    ) : (
                      <pre className="whitespace-pre-wrap font-[inherit]">
                        {idleMessage ??
                          `${app.name}\n\nSIM loaded: ${app.shortcode}\nPress CALL or pick a scenario on the left.`}
                      </pre>
                    )}
                    {error && <p className="mt-2 text-rose-400">{error}</p>}
                    {frame?.prefix === "END" && <p className="mt-2.5 opacity-65">-- Session closed. Press CALL --</p>}
                  </div>

                  {/* Keypad Input Line */}
                  <form
                    onSubmit={submit}
                    className="flex items-center gap-1 border-t border-[color-mix(in_srgb,var(--screen-text)_25%,transparent)] pt-1 text-[21px]"
                  >
                    <span aria-hidden>{inSession ? ">" : "#"}</span>
                    <input
                      ref={inputRef}
                      value={entry}
                      onChange={(event) => setEntry(event.target.value)}
                      onKeyDown={onKeyDown}
                      maxLength={160}
                      placeholder={inSession ? "Reply..." : app.shortcode}
                      aria-label={inSession ? "USSD reply" : "Number to dial"}
                      className="lcd-input w-full"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {busy && <span className="animate-pulse">...</span>}
                  </form>
                </div>
              </div>

              {/* Physical Softkeys + Sculpted 5-Way D-Pad Center Rocker */}
              <div className="depth-keys mt-3.5 grid grid-cols-[1fr_92px_1fr] items-center gap-2">
                <button
                  type="button"
                  className="key rounded-xl py-2.5 font-mono text-[11px] font-semibold text-white/85 disabled:opacity-35"
                  disabled={!inSession || busy}
                  onClick={() => sendKey(nav.backKey)}
                >
                  {nav.backKey} · Back
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (inSession ? sendKey(nav.homeKey) : submit())}
                  title={inSession ? `${nav.homeKey} · Home menu` : `Dial ${app.shortcode}`}
                  className="dpad-ring flex h-12 flex-col items-center justify-center rounded-2xl transition active:scale-95 disabled:opacity-45"
                >
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--screen-text)" }}>
                    {inSession ? `${nav.homeKey} HOME` : "DIAL"}
                  </span>
                  <span className="text-[9px] text-white/40">● OK ●</span>
                </button>

                <button
                  type="button"
                  className="key rounded-xl py-2.5 font-mono text-[11px] font-semibold disabled:opacity-35"
                  style={{ color: hasMorePages ? "var(--brand-accent)" : "rgba(255,255,255,0.85)" }}
                  disabled={!inSession || busy || !hasMorePages}
                  onClick={() => sendKey(nav.nextPageKey)}
                >
                  {nav.nextPageKey} · More
                </button>
              </div>

              {/* Dedicated Call / Clear / End Action Row */}
              <div className="depth-keys mt-2.5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => submit()}
                  disabled={busy}
                  className="rounded-xl border border-white/15 py-2.5 font-mono text-xs font-bold text-black shadow-lg transition hover:brightness-110 active:translate-y-0.5 disabled:opacity-50"
                  style={{
                    background: "var(--screen-text)",
                    boxShadow: "0 6px 20px -4px color-mix(in srgb, var(--screen-text) 55%, transparent)",
                  }}
                >
                  ☎ {inSession ? "SEND" : "CALL"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playDtmf("*", soundOn);
                    setEntry((v) => v.slice(0, -1));
                  }}
                  className="key rounded-xl py-2.5 font-mono text-xs text-white/80"
                  aria-label="Delete last character"
                >
                  ⌫ CLEAR
                </button>
                <button
                  type="button"
                  onClick={onHangUp}
                  className="rounded-xl border border-rose-400/30 bg-gradient-to-b from-rose-500 to-rose-700 py-2.5 font-mono text-xs font-bold text-white shadow-lg shadow-rose-950/60 transition hover:brightness-110 active:translate-y-0.5"
                >
                  ✖ END
                </button>
              </div>

              {/* 12 Backlit Sculpted T9 Push-Buttons */}
              <div className="depth-keys mt-3 grid grid-cols-3 gap-2">
                {KEYS.map(([key, letters]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => press(key)}
                    className={`key flex h-12 flex-col items-center justify-center rounded-2xl ${
                      pressedKey === key ? "key-pressed" : ""
                    }`}
                  >
                    <span className="key-legend font-mono text-lg font-bold leading-none">{key}</span>
                    <span
                      className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em]"
                      style={{ color: "color-mix(in srgb, var(--screen-text) 55%, rgba(255,255,255,0.35))" }}
                    >
                      {letters}
                    </span>
                  </button>
                ))}
              </div>

              {/* Bottom microphone pinhole & chassis screws */}
              <div className="mt-4 flex items-center justify-between px-2">
                <span className="screw" aria-hidden />
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-black shadow-inner" />
                  <span>GSM-7 · 160 SEPTETS</span>
                </div>
                <span className="screw" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div ref={shadowRef} className="phone-shadow" aria-hidden />
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { UssdApp, UssdFrame } from "../lib/types";

interface Props {
  app: UssdApp;
  frame: UssdFrame | null;
  busy: boolean;
  lastActivity: number;
  error: string | null;
  idleMessage: string | null;
  onDial: (composed: string) => void;
  onSend: (input: string) => void;
  onHangUp: () => void;
  onPreset: (inputs: string) => void;
}

const KEYS: Array<[string, string]> = [
  ["1", ""], ["2", "abc"], ["3", "def"],
  ["4", "ghi"], ["5", "jkl"], ["6", "mno"],
  ["7", "pqrs"], ["8", "tuv"], ["9", "wxyz"],
  ["*", ""], ["0", "+"], ["#", ""],
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
          className="w-[3px] rounded-sm"
          style={{ height: h, background: i < 3 ? "var(--screen-text)" : "color-mix(in srgb, var(--screen-text) 25%, transparent)" }}
        />
      ))}
    </span>
  );
}

function Battery() {
  return (
    <span className="flex items-center" aria-label="battery">
      <span className="relative h-[9px] w-[18px] rounded-[2px] border border-[var(--screen-text)] p-[1px]">
        <span className="block h-full w-[70%] bg-[var(--screen-text)]" />
      </span>
      <span className="h-[4px] w-[2px] bg-[var(--screen-text)]" />
    </span>
  );
}

export function RetroPhone({ app, frame, busy, lastActivity, error, idleMessage, onDial, onSend, onHangUp, onPreset }: Props) {
  const [entry, setEntry] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inSession = frame?.prefix === "CON";
  const now = useNow(inSession);
  const nav = app.navigation;
  const remaining = inSession ? Math.max(0, nav.sessionTimeoutSec - Math.floor((now - lastActivity) / 1000)) : 0;
  const hasMorePages = !!frame && frame.page_index < frame.total_pages - 1;

  useEffect(() => setEntry(""), [frame, app.id]);

  // Typing anywhere on the page goes to the phone, unless another field has focus.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    setEntry((value) => value + key);
    inputRef.current?.focus();
  };

  const sendKey = (key: string) => {
    if (inSession && !busy) onSend(key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onHangUp();
    }
  };

  const charRatio = frame ? frame.char_count / frame.max_chars : 0;

  return (
    <div className="bezel mx-auto w-full max-w-[360px] rounded-[2.75rem] p-5 pb-6">
      {/* earpiece + brand */}
      <div className="mb-3 flex flex-col items-center gap-2">
        <span className="h-1.5 w-16 rounded-full bg-black/60 shadow-inner" />
        <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">GhostSignal</span>
      </div>

      {/* LCD */}
      <div className="lcd rounded-2xl px-4 pb-3 pt-2">
        <div className="flex items-center justify-between text-[15px] leading-none opacity-90">
          <span className="flex items-center gap-1.5">
            <SignalBars />
            <span>2G</span>
            <span className="led-2g inline-block h-1.5 w-1.5 rounded-full" />
          </span>
          <span>{app.theme.badgeLabel}</span>
          <span className="flex items-center gap-2">
            {inSession && <span aria-label="session countdown">{remaining}s</span>}
            <Battery />
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between border-y border-[color-mix(in_srgb,var(--screen-text)_25%,transparent)] py-1 text-[15px] leading-none">
          <span>USSD {app.shortcode}</span>
          {frame ? (
            <span className="flex items-center gap-2">
              <span className="rounded-sm bg-[var(--screen-text)] px-1 text-[var(--screen-bg)]">{frame.prefix}</span>
              <span className={charRatio > 1 ? "text-rose-400" : undefined}>
                {frame.char_count}/{frame.max_chars}
              </span>
            </span>
          ) : (
            <span>IDLE</span>
          )}
        </div>

        <div className="h-[230px] overflow-y-auto py-2 text-[21px] leading-[1.08]" aria-live="polite">
          {busy && !frame ? (
            <p className="animate-pulse">Sending USSD...</p>
          ) : frame ? (
            <pre className="whitespace-pre-wrap break-words font-[inherit]">{frame.body}</pre>
          ) : (
            <pre className="whitespace-pre-wrap font-[inherit]">
              {idleMessage ?? `${app.name}\n\nDial ${app.shortcode}\nthen press CALL.\n\nOr pick a Quick demo below.`}
            </pre>
          )}
          {error && <p className="mt-2 text-rose-400">{error}</p>}
          {frame?.prefix === "END" && <p className="mt-3 opacity-60">-- Session closed. CALL to redial --</p>}
        </div>

        <form onSubmit={submit} className="flex items-center gap-1 border-t border-[color-mix(in_srgb,var(--screen-text)_25%,transparent)] pt-1.5 text-[21px]">
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

      {/* soft keys */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <button type="button" className="key rounded-lg py-2 text-white/80 disabled:opacity-30" disabled={!inSession || busy} onClick={() => sendKey(nav.backKey)}>
          {nav.backKey} · Back
        </button>
        <button type="button" className="key rounded-lg py-2 text-white/80 disabled:opacity-30" disabled={!inSession || busy} onClick={() => sendKey(nav.homeKey)}>
          {nav.homeKey} · Home
        </button>
        <button
          type="button"
          className="key rounded-lg py-2 font-semibold disabled:opacity-30"
          style={{ color: hasMorePages ? "var(--brand-accent)" : undefined }}
          disabled={!inSession || busy || !hasMorePages}
          onClick={() => sendKey(nav.nextPageKey)}
        >
          {nav.nextPageKey} · More
        </button>
      </div>

      {/* keypad */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {KEYS.map(([key, letters]) => (
          <button key={key} type="button" onClick={() => press(key)} className="key flex h-12 flex-col items-center justify-center rounded-xl text-white">
            <span className="text-lg font-semibold leading-none">{key}</span>
            <span className="text-[9px] uppercase tracking-widest text-white/40">{letters || "\u00a0"}</span>
          </button>
        ))}
      </div>

      {/* call / clear / hang up */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => submit()} disabled={busy} className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 disabled:opacity-50">
          {inSession ? "SEND" : "CALL"}
        </button>
        <button type="button" onClick={() => setEntry((v) => v.slice(0, -1))} className="key rounded-xl py-3 text-sm text-white/80" aria-label="Delete last character">
          ⌫
        </button>
        <button type="button" onClick={onHangUp} className="rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-900/40 hover:bg-rose-500">
          END
        </button>
      </div>

      {/* quick presets from the manifest */}
      {app.quickPresets.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-white/40">Quick demo · one click</div>
          <div className="flex flex-col gap-1.5">
            {app.quickPresets.map((preset) => (
              <button
                key={preset.inputs}
                type="button"
                disabled={busy}
                onClick={() => onPreset(preset.inputs)}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-left text-sm text-white/85 transition hover:border-[var(--brand-primary)] hover:bg-black/40 disabled:opacity-50"
              >
                <span>{preset.label}</span>
                <code className="shrink-0 font-mono text-[11px]" style={{ color: "var(--brand-accent)" }}>
                  {app.shortcode.replace(/#$/, "")}*{preset.inputs.length > 18 ? `${preset.inputs.slice(0, 16)}…` : preset.inputs}#
                </code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

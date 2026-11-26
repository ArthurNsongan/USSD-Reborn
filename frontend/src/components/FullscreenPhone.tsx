import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { fetchApps, randomId, sendUssd } from "../lib/api";
import { parseDial, useThemeVariables } from "../lib/theme";
import type { UssdApp, UssdFrame } from "../lib/types";

const KEYS: Array<[string, string]> = [
  ["1", ""], ["2", "abc"], ["3", "def"],
  ["4", "ghi"], ["5", "jkl"], ["6", "mno"],
  ["7", "pqrs"], ["8", "tuv"], ["9", "wxyz"],
  ["*", ""], ["0", "+"], ["#", ""],
];
const DEMO_PHONE = "+237690000000";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const isStandalone = () =>
  window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
  (navigator as NavigatorWithStandalone).standalone === true;

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const buzz = () => navigator.vibrate?.(8);

async function enterFullscreen() {
  if (!document.fullscreenEnabled || document.fullscreenElement || isStandalone()) return;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.("portrait").catch(() => undefined);
  } catch {
    /* refused by the browser (no user gesture, iPhone Safari): the page still fills the viewport */
  }
}

/** Mobile-first, full-viewport USSD handset. Everything app-specific comes from /api/apps. */
export function FullscreenPhone() {
  const [apps, setApps] = useState<UssdApp[]>([]);
  const [app, setApp] = useState<UssdApp | null>(null);
  const [frame, setFrame] = useState<UssdFrame | null>(null);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [showIosHint, setShowIosHint] = useState(false);
  const session = useRef({ id: "", text: "", seq: 0 });
  const fullscreenTried = useRef(false);

  useThemeVariables(app);
  const inSession = frame?.prefix === "CON";
  const hasMore = !!frame && frame.page_index < frame.total_pages - 1;
  const remaining = inSession && app ? Math.max(0, app.navigation.sessionTimeoutSec - Math.floor((now - lastActivity) / 1000)) : 0;

  useEffect(() => {
    if (!inSession) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [inSession]);

  const request = useCallback(async (target: UssdApp, text: string) => {
    const seq = ++session.current.seq;
    setBusy(true);
    setError(null);
    try {
      const { frame: next } = await sendUssd({
        session_id: session.current.id,
        app_id: target.id,
        phone_number: DEMO_PHONE,
        text,
        input_mode: "cumulative", // full history: any serverless instance can rebuild the session
      });
      if (seq !== session.current.seq) return;
      session.current.text = text;
      setFrame(next);
      setLastActivity(Date.now());
      setNow(Date.now());
    } catch (exc) {
      if (seq === session.current.seq) setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      if (seq === session.current.seq) setBusy(false);
    }
  }, []);

  const dial = useCallback(
    (target: UssdApp, text = "") => {
      session.current = { id: randomId("phone-"), text: "", seq: session.current.seq };
      setApp(target);
      setFrame(null);
      setNotice(null);
      setEntry("");
      void request(target, text);
    },
    [request],
  );

  // Boot: ?app=<id> or ?dial=*384*2# picks the service, otherwise the first app is dialed.
  useEffect(() => {
    fetchApps()
      .then((rawList) => {
        const list = [...rawList].sort((a, b) => a.shortcode.localeCompare(b.shortcode));
        setApps(list);
        const params = new URLSearchParams(window.location.search);
        const fromDial = params.get("dial") ? parseDial(list, params.get("dial") ?? "") : null;
        const fromId = list.find((a) => a.id === params.get("app"));
        const first = fromDial?.app ?? fromId ?? list[0];
        if (first) dial(first, fromDial?.text ?? "");
      })
      .catch((exc: unknown) => setError(exc instanceof Error ? exc.message : String(exc)));
    setShowIosHint(isIos() && !isStandalone() && localStorage.getItem("gs-ios-hint") !== "seen");
  }, [dial]);

  // Android/desktop: go full screen on the first tap (browsers require a user gesture).
  useEffect(() => {
    const onFirstTap = () => {
      if (fullscreenTried.current) return;
      fullscreenTried.current = true;
      void enterFullscreen();
    };
    window.addEventListener("pointerdown", onFirstTap, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstTap);
  }, []);

  const send = (value: string) => {
    if (!app || !inSession || busy || !value) return;
    const text = session.current.text ? `${session.current.text}*${value}` : value;
    setEntry("");
    void request(app, text);
  };

  const call = (event?: FormEvent) => {
    event?.preventDefault();
    buzz();
    if (busy) return;
    if (inSession) return send(entry.trim());
    const composed = entry.trim();
    if (!composed && app) return dial(app);
    const target = parseDial(apps, composed);
    if (target) return dial(target.app, target.text);
    session.current.seq++;
    setFrame(null);
    setNotice(`Unknown code ${composed}\n\n${apps.map((a) => `${a.shortcode}  ${a.name}`).join("\n")}`);
  };

  const hangUp = () => {
    buzz();
    session.current.seq++;
    setBusy(false);
    setFrame(null);
    setEntry("");
    setNotice(app ? `Call ended.\n\nPress CALL to dial ${app.shortcode}\nor type another code.` : null);
  };

  const press = (key: string) => {
    buzz();
    setEntry((value) => (value + key).slice(0, 160));
  };

  const dismissHint = () => {
    localStorage.setItem("gs-ios-hint", "seen");
    setShowIosHint(false);
  };

  const softKey = "key flex-1 rounded-xl py-2.5 text-xs font-semibold text-white/85 disabled:opacity-30";

  return (
    <div className="bezel flex h-[100dvh] flex-col gap-2 overflow-hidden rounded-none px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-[max(8px,env(safe-area-inset-top))]">
      {/* service picker */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {apps.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => dial(candidate)}
            className="shrink-0 rounded-full border px-3 py-1 font-mono text-xs"
            style={{
              borderColor: candidate.id === app?.id ? candidate.theme.primaryColor : "rgb(255 255 255 / 0.12)",
              color: candidate.id === app?.id ? candidate.theme.screenText : "rgb(255 255 255 / 0.6)",
              background: candidate.id === app?.id ? candidate.theme.screenBg : "transparent",
            }}
          >
            {candidate.theme.icon} {candidate.shortcode}
          </button>
        ))}
        <a href="/" className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-widest text-white/40">
          Lab view
        </a>
      </div>

      {showIosHint && (
        <button type="button" onClick={dismissHint} className="rounded-xl bg-black/50 px-3 py-2 text-left text-xs text-white/80">
          Full screen on iPhone: tap <b>Share</b>, then <b>Add to Home Screen</b>, and open GhostSignal from there. (tap to close)
        </button>
      )}

      {/* LCD */}
      <div className="lcd flex min-h-0 flex-1 flex-col rounded-2xl px-3 pb-2 pt-2">
        <div className="flex items-center justify-between text-[15px] leading-none">
          <span className="flex items-center gap-1.5">
            <span className="flex items-end gap-[2px]" aria-label="2G signal">
              {[4, 7, 10, 13].map((h, i) => (
                <span
                  key={h}
                  className="w-[3px] rounded-sm"
                  style={{ height: h, background: i < 3 ? "var(--screen-text)" : "color-mix(in srgb, var(--screen-text) 25%, transparent)" }}
                />
              ))}
            </span>
            2G <span className="led-2g inline-block h-1.5 w-1.5 rounded-full" />
          </span>
          <span>{app?.theme.badgeLabel ?? "GHOSTSIGNAL"}</span>
          <span>{inSession ? `${remaining}s` : "IDLE"}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between border-y border-[color-mix(in_srgb,var(--screen-text)_25%,transparent)] py-1 text-[15px] leading-none">
          <span>USSD {app?.shortcode ?? ""}</span>
          {frame && (
            <span className="flex items-center gap-2">
              <span className="rounded-sm bg-[var(--screen-text)] px-1 text-[var(--screen-bg)]">{frame.prefix}</span>
              {frame.char_count}/{frame.max_chars}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2 text-[clamp(19px,5.6vw,26px)] leading-[1.1]" aria-live="polite">
          {busy && !frame ? (
            <p className="animate-pulse">Sending USSD...</p>
          ) : frame ? (
            <pre className="whitespace-pre-wrap break-words font-[inherit]">{frame.body}</pre>
          ) : (
            <pre className="whitespace-pre-wrap font-[inherit]">{notice ?? "Connecting to the 2G network..."}</pre>
          )}
          {error && <p className="mt-2 text-rose-400">{error}</p>}
          {frame?.prefix === "END" && <p className="mt-3 opacity-60">-- Session closed. CALL to redial --</p>}
        </div>
        <form onSubmit={call} className="flex items-center gap-1 border-t border-[color-mix(in_srgb,var(--screen-text)_25%,transparent)] pt-1.5 text-[clamp(19px,5.6vw,26px)]">
          <span aria-hidden>{inSession ? ">" : "#"}</span>
          <input
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            maxLength={160}
            enterKeyHint={inSession ? "send" : "go"}
            placeholder={inSession ? "Reply (tap for letters)" : app?.shortcode ?? ""}
            aria-label={inSession ? "USSD reply" : "Number to dial"}
            className="lcd-input w-full"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          {busy && <span className="animate-pulse">...</span>}
        </form>
      </div>

      {/* soft keys */}
      {app && (
        <div className="flex gap-2">
          <button type="button" className={softKey} disabled={!inSession || busy} onClick={() => { buzz(); send(app.navigation.backKey); }}>
            {app.navigation.backKey} · Back
          </button>
          <button type="button" className={softKey} disabled={!inSession || busy} onClick={() => { buzz(); send(app.navigation.homeKey); }}>
            {app.navigation.homeKey} · Home
          </button>
          <button
            type="button"
            className={softKey}
            style={{ color: hasMore ? "var(--brand-accent)" : undefined }}
            disabled={!inSession || busy || !hasMore}
            onClick={() => { buzz(); send(app.navigation.nextPageKey); }}
          >
            {app.navigation.nextPageKey} · More
          </button>
        </div>
      )}

      {/* keypad */}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map(([key, letters]) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="key flex h-[clamp(44px,7.2dvh,62px)] flex-col items-center justify-center rounded-2xl text-white [touch-action:manipulation]"
          >
            <span className="text-xl font-semibold leading-none">{key}</span>
            <span className="text-[9px] uppercase tracking-widest text-white/40">{letters || "\u00a0"}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => call()}
          disabled={busy}
          className="h-[clamp(44px,7dvh,58px)] rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 [touch-action:manipulation] disabled:opacity-50"
        >
          {inSession ? "SEND" : "CALL"}
        </button>
        <button
          type="button"
          onClick={() => { buzz(); setEntry((v) => v.slice(0, -1)); }}
          className="key rounded-2xl text-lg text-white/80 [touch-action:manipulation]"
          aria-label="Delete last character"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={hangUp}
          className="rounded-2xl bg-rose-600 text-sm font-bold text-white shadow-lg shadow-rose-900/40 [touch-action:manipulation]"
        >
          END
        </button>
      </div>
    </div>
  );
}

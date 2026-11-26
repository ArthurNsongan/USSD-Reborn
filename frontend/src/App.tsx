import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppSwitcher } from "./components/AppSwitcher";
import { GoalSection } from "./components/GoalSection";
import { HauntedBackdrop } from "./components/HauntedBackdrop";
import { HowItWorks } from "./components/HowItWorks";
import { InspectorSection } from "./components/InspectorSection";
import { KiroSection } from "./components/KiroSection";
import { RetroPhone } from "./components/RetroPhone";
import { ServicesSection } from "./components/ServicesSection";
import { fetchApps, fetchMetrics, randomId, sendUssd } from "./lib/api";
import { isMusicPlaying, playHandshake, startSpookyMusic, stopSpookyMusic } from "./lib/sound";
import { parseDial, useThemeVariables } from "./lib/theme";
import type { HistoryEntry, InputMode, Metrics, UssdApp, UssdFrame } from "./lib/types";

gsap.registerPlugin(ScrollTrigger);

const DEMO_PHONE = "+237690000000";
const METRICS_POLL_MS = 10_000;
const QUICK_SPELLS = 3;

const NAV = [
  { href: "#goal", label: "Goal" },
  { href: "#how", label: "How it works" },
  { href: "#services", label: "Services" },
  { href: "#inspector", label: "X-Ray" },
  { href: "#kiro", label: "Kiro" },
];

/** Staggered reveal of every [data-reveal] item inside each [data-reveal-group] when it scrolls into view. */
function useScrollReveal(ready: boolean) {
  useLayoutEffect(() => {
    if (!ready) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
        gsap.from(group.querySelectorAll("[data-reveal]"), {
          y: 28,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          stagger: 0.12,
          scrollTrigger: { trigger: group, start: "top 82%", once: true },
        });
      });
    });
    return () => mm.revert();
  }, [ready]);
}

function GhostCrest() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="14" stroke="var(--screen-text)" strokeOpacity="0.25" strokeWidth="1.5" />
      <path
        d="M11 24V13.5C11 10.7386 13.2386 8.5 16 8.5C18.7614 8.5 21 10.7386 21 13.5V24L19.2 22.3L17.6 24L16 22.3L14.4 24L12.8 22.3L11 24Z"
        stroke="var(--screen-text)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="14.2" cy="14" r="1.2" fill="var(--screen-text)" />
      <circle cx="17.8" cy="14" r="1.2" fill="var(--screen-text)" />
    </svg>
  );
}

function BackendDown({ error }: { error: string }) {
  return (
    <div className="panel mx-auto mt-24 max-w-xl rounded-3xl p-8">
      <h1 className="font-display text-2xl font-bold">Backend unreachable</h1>
      <p className="mt-2 text-white/60">
        The simulator could not load <code className="font-mono">/api/apps</code> ({error}).
      </p>
      <p className="mt-4 text-sm text-white/70">Start the FastAPI skeleton from the repository root, then reload this page:</p>
      <pre className="mt-2 rounded-xl bg-black/50 p-3 font-mono text-sm text-emerald-300">uvicorn main:app --reload --port 8000</pre>
    </div>
  );
}

export default function App() {
  const [apps, setApps] = useState<UssdApp[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [frame, setFrame] = useState<UssdFrame | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [idleMessage, setIdleMessage] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [burstTick, setBurstTick] = useState(0);
  const requestSeq = useRef(0); // ignores late answers after a hang-up or an app switch
  const booted = useRef(false);
  // Full input history of the current session ("1*2*1"), so a stateless server instance can rebuild it.
  const dialedText = useRef("");

  const app = apps.find((a) => a.id === activeId) ?? null;
  useThemeVariables(app);
  useScrollReveal(app !== null);

  // Browsers only allow audio after a user gesture, so the loop starts from the navbar button.
  const toggleMusic = () => {
    if (isMusicPlaying()) stopSpookyMusic();
    else startSpookyMusic();
    setMusicOn(isMusicPlaying());
  };
  useEffect(() => () => stopSpookyMusic(), []);

  const refreshMetrics = useCallback(async () => {
    try {
      setMetrics(await fetchMetrics());
    } catch {
      /* metrics are informative only */
    }
  }, []);

  useEffect(() => {
    fetchApps()
      .then((list) => {
        const ordered = [...list].sort((a, b) => a.shortcode.localeCompare(b.shortcode));
        setApps(ordered);
        setActiveId((current) => current || ordered[0]?.id || "");
      })
      .catch((exc: unknown) => setLoadError(exc instanceof Error ? exc.message : String(exc)));
    void refreshMetrics();
    const timer = window.setInterval(() => void refreshMetrics(), METRICS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshMetrics]);

  const exchange = useCallback(
    async (sid: string, appId: string, text: string, mode: InputMode, label: string) => {
      const seq = ++requestSeq.current;
      setBusy(true);
      setRequestError(null);
      try {
        const { frame: next, roundTripMs } = await sendUssd({
          session_id: sid,
          app_id: appId,
          phone_number: DEMO_PHONE,
          text,
          input_mode: mode,
        });
        if (seq !== requestSeq.current) return;
        if (mode === "cumulative") dialedText.current = text;
        setFrame(next);
        setHistory((items) => [...items, { at: Date.now(), input: label, roundTripMs, frame: next }]);
        setVisited((items) => [...items, ...next.stack, next.current_node]);
        setLastActivity(Date.now());
      } catch (exc) {
        if (seq === requestSeq.current) setRequestError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (seq === requestSeq.current) setBusy(false);
        void refreshMetrics();
      }
    },
    [refreshMetrics],
  );

  const dial = useCallback(
    (target: UssdApp, text = "") => {
      const sid = randomId("sim-");
      playHandshake(soundOn);
      setBurstTick((tick) => tick + 1); // bats fly out and the handset is possessed
      setActiveId(target.id);
      setSessionId(sid);
      setFrame(null);
      setHistory([]);
      setVisited([]);
      setIdleMessage(null);
      dialedText.current = "";
      const label = text ? `${target.shortcode.slice(0, -1)}*${text}#` : target.shortcode;
      void exchange(sid, target.id, text, "cumulative", label);
    },
    [exchange, soundOn],
  );

  // First paint: dial the first service so a judge sees a live USSD menu immediately.
  useEffect(() => {
    if (booted.current || !apps[0]) return;
    booted.current = true;
    dial(apps[0]);
  }, [apps, dial]);

  const dialComposed = (composed: string) => {
    const target = parseDial(apps, composed);
    if (target) return dial(target.app, target.text);
    requestSeq.current++;
    setFrame(null);
    setBusy(false);
    setIdleMessage(`Unknown USSD code\n${composed}\n\nAvailable:\n${apps.map((a) => `${a.shortcode} ${a.name}`).join("\n")}`);
  };

  const send = (input: string) => {
    if (!app || frame?.prefix !== "CON" || !input) return;
    const text = dialedText.current ? `${dialedText.current}*${input}` : input;
    void exchange(sessionId, app.id, text, "cumulative", input);
  };

  const hangUp = () => {
    requestSeq.current++;
    setBusy(false);
    setFrame(null);
    setSessionId("");
    setIdleMessage(null);
  };

  const selectApp = (appId: string) => {
    const target = apps.find((a) => a.id === appId);
    if (target) dial(target);
  };

  const loadFromCard = (appId: string) => {
    selectApp(appId);
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
  };

  if (loadError) return <BackendDown error={loadError} />;
  if (!app) return <div className="p-10 font-mono text-white/50">Tuning in to the 2G signal...</div>;

  const loc = metrics?.core_loc ?? 0;
  const maxLoc = metrics?.max_loc ?? 400;

  return (
    <div className="min-h-screen">
      <HauntedBackdrop burstTick={burstTick} />
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#06060a]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="#top" className="flex items-center gap-2.5">
            <GhostCrest />
            <span className="font-display text-base font-extrabold tracking-tight">
              GHOST<span style={{ color: "var(--screen-text)" }}>SIGNAL</span>
            </span>
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="text-sm text-white/55 transition hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggleMusic}
              aria-pressed={musicOn}
              title="Haunted 2G Synthwave, 114 BPM in D harmonic minor"
              className="rounded-full border px-2.5 py-1.5 font-mono text-xs sm:px-3 transition hover:border-white/30"
              style={{
                borderColor: musicOn ? "var(--screen-text)" : "rgb(255 255 255 / 0.1)",
                color: musicOn ? "var(--screen-text)" : "rgb(255 255 255 / 0.7)",
              }}
            >
              🎵<span className="hidden sm:inline"> {musicOn ? "Music on" : "Spooky music"}</span>
            </button>
            <button
              type="button"
              onClick={() => setSoundOn((value) => !value)}
              aria-pressed={soundOn}
              aria-label={soundOn ? "Mute keypad tones and effects" : "Unmute keypad tones and effects"}
              title="Keypad tones and sound effects"
              className="rounded-full border border-white/10 px-2.5 py-1.5 font-mono text-xs sm:px-3 text-white/70 transition hover:border-white/30"
            >
              {soundOn ? "🔊" : "🔇"}
              <span className="hidden sm:inline"> SFX</span>
            </button>
            <a
              href="/phone/"
              className="rounded-full border border-white/10 px-2.5 py-1.5 font-mono text-xs sm:px-3 text-white/70 transition hover:border-white/30"
            >
                📱<span className="hidden sm:inline"> Phone</span>
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5">
        {/* Hero: one sentence of story on the left, the live phone on the right. */}
        <section id="top" className="grid scroll-mt-20 grid-cols-1 items-center gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
              <span className="led-2g inline-block h-1.5 w-1.5 rounded-full" />
              Kiroween 2026 · Skeleton Crew
            </div>

            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              When the Internet dies,{" "}
              <span className="font-editorial font-normal italic" style={{ color: "var(--screen-text)" }}>
                the 2G ghost signal
              </span>{" "}
              survives.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              USSD is the 2G protocol behind codes like <code className="font-mono text-white/85">*126#</code>. It works on any
              push-button phone, with no data and no app. GhostSignal turns that forgotten channel into real services.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#how"
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
                style={{ background: "var(--screen-text)" }}
              >
                How it works
              </a>
              <a
                href="#services"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/35"
              >
                See the {apps.length} services
              </a>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6">
              <div>
                <dt className="font-mono text-[11px] text-white/45">services, one engine</dt>
                <dd className="mt-1 font-display text-3xl font-bold tabular-nums">{apps.length}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-white/45">lines in core/ (max {maxLoc})</dt>
                <dd className="mt-1 font-display text-3xl font-bold tabular-nums">{loc || "..."}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-white/45">characters per screen</dt>
                <dd className="mt-1 font-display text-3xl font-bold tabular-nums">≤ 160</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col items-center gap-4">
            <AppSwitcher apps={apps} activeId={app.id} onSelect={selectApp} />
            <RetroPhone
              app={app}
              frame={frame}
              busy={busy}
              lastActivity={lastActivity}
              error={requestError}
              idleMessage={idleMessage}
              soundOn={soundOn}
              hauntedCrt
              poltergeistTick={burstTick}
              onDial={dialComposed}
              onSend={send}
              onHangUp={hangUp}
            />
            {app.quickPresets.length > 0 && (
              <div className="w-full max-w-[356px]">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">Quick spells</div>
                <div className="flex flex-wrap gap-1.5">
                  {app.quickPresets.slice(0, QUICK_SPELLS).map((preset) => (
                    <button
                      key={preset.inputs}
                      type="button"
                      disabled={busy}
                      onClick={() => dial(app, preset.inputs)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70 transition hover:border-[var(--screen-text)] hover:text-white disabled:opacity-40"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 font-mono text-[10px] text-white/35">Keyboard works too: 0-9 * #, Enter to send, Esc to hang up.</p>
              </div>
            )}
          </div>
        </section>

        <GoalSection />
        <HowItWorks app={app} />
        <ServicesSection apps={apps} activeId={app.id} onLoad={loadFromCard} />
        <InspectorSection app={app} apps={apps} frame={frame} history={history} visited={visited} metrics={metrics} />
        <KiroSection apps={apps} />
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] bg-[#06060a]/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 py-6 font-mono text-[11px] text-white/35">
          <span>GhostSignal · USSD-Reborn · Kiroween 2026, Skeleton Crew</span>
          <span>No SIM card, no API key: deterministic GSM-7 fallback by default. MIT licensed.</span>
        </div>
      </footer>
    </div>
  );
}

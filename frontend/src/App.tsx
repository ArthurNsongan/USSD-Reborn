import { useCallback, useEffect, useRef, useState } from "react";
import { AppSwitcher } from "./components/AppSwitcher";
import { FlowVisualizer } from "./components/FlowVisualizer";
import { FrameInspector } from "./components/FrameInspector";
import { RetroPhone } from "./components/RetroPhone";
import { SkeletonProofBar } from "./components/SkeletonProofBar";
import { TelecomCurlPanel } from "./components/TelecomCurlPanel";
import { fetchApps, fetchMetrics, randomId, sendUssd } from "./lib/api";
import { playHandshake } from "./lib/sound";
import type { HistoryEntry, InputMode, Metrics, UssdApp, UssdFrame } from "./lib/types";

type TabId = "inspector" | "tree" | "telecom";

const TABS: Array<{ id: TabId; label: string; hint: string }> = [
  { id: "inspector", label: "1. Live SS7 Frame Inspector", hint: "CON/END · n/160 · GSM-7 · AI fallback" },
  { id: "tree", label: "2. Manifest Decision Tree", hint: "Declarative JSON node graph" },
  { id: "telecom", label: "3. Africa's Talking Webhook", hint: "form-urlencoded + copyable cURL" },
];

const MCP_PROMPTS = [
  "Use MCP to dial *384*1# and check if drug seal RX-2026-860 is authentic or counterfeit.",
  "Use MCP to dial *384*2# and order 2 packs of Poulet DG to Akwa Total Gate.",
  "Use MCP to ask the NightRx 2G triage copilot: high fever 39C child 14kg.",
  "Run the Skeleton Crew compliance audit via MCP and verify core/ is under 400 LOC with 0 leaks.",
];

const DEMO_PHONE = "+237690000000";
const METRICS_POLL_MS = 10_000;

function useThemeVariables(app: UssdApp | null) {
  useEffect(() => {
    if (!app) return;
    const style = document.documentElement.style;
    style.setProperty("--screen-bg", app.theme.screenBg);
    style.setProperty("--screen-text", app.theme.screenText);
    style.setProperty("--brand-primary", app.theme.primaryColor);
    style.setProperty("--brand-accent", app.theme.accentColor);
    style.setProperty("--bezel", app.theme.bezelColor);
  }, [app]);
}

function GhostCrest() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="14" stroke="var(--screen-text)" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="16" cy="14" r="7.5" stroke="var(--screen-text)" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="3 2" />
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
  const [tab, setTab] = useState<TabId>("inspector");
  const [soundOn, setSoundOn] = useState(true);
  const [hauntedCrt, setHauntedCrt] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const requestSeq = useRef(0);
  const booted = useRef(false);
  // Full input history of the current session ("1*2*1") so stateless Vercel instances can rebuild it.
  const dialedText = useRef("");

  const app = apps.find((a) => a.id === activeId) ?? null;
  useThemeVariables(app);

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
        // Order by shortcode (*384*1# NightRx first, *384*2# Bite2G second, etc.)
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

  useEffect(() => {
    if (booted.current || !apps[0]) return;
    booted.current = true;
    dial(apps[0]);
  }, [apps, dial]);

  const dialComposed = (composed: string) => {
    const code = composed.replace(/\s+/g, "");
    const exact = apps.find((a) => a.shortcode === code);
    if (exact) return dial(exact);
    for (const candidate of apps) {
      const base = candidate.shortcode.slice(0, -1);
      if (code.startsWith(`${base}*`) && code.endsWith("#")) return dial(candidate, code.slice(base.length + 1, -1));
    }
    requestSeq.current++;
    setFrame(null);
    setBusy(false);
    setIdleMessage(`Unknown USSD code\n${code}\n\nAvailable:\n${apps.map((a) => `${a.shortcode} ${a.name}`).join("\n")}`);
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

  if (loadError) return <BackendDown error={loadError} />;
  if (!app) return <div className="p-10 font-mono text-white/50">Tuning 2G GhostSignal frequencies...</div>;

  const path = frame ? [...frame.stack, frame.current_node] : [];
  const loc = metrics?.core_loc ?? 386;
  const maxLoc = metrics?.max_loc ?? 400;

  return (
    <div className="min-h-screen">
      {/* ---- Top Minimal Sticky Navbar -------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#06060a]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <GhostCrest />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-extrabold tracking-tight text-white">
                  GHOST<span style={{ color: "var(--screen-text)" }}>SIGNAL</span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-white/60">
                  Kiroween 2026 · Skeleton Crew
                </span>
              </div>
              <div className="font-mono text-[10px] text-white/40">
                Universal 2G USSD Skeleton · {loc}/{maxLoc} core LOC · 0 domain leaks
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/phone/"
              className="rounded-full border border-[var(--screen-text)]/40 bg-white/[0.04] px-3 py-1 font-mono text-xs font-semibold text-[var(--brand-accent)] transition hover:border-[var(--screen-text)]"
            >
              📱 Phone mode
            </a>
            <button
              type="button"
              onClick={() => setSoundOn((v) => !v)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs text-white/80 transition hover:border-white/25"
            >
              {soundOn ? "🔊 DTMF ON" : "🔇 DTMF MUTE"}
            </button>
            <button
              type="button"
              onClick={() => setHauntedCrt((v) => !v)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs text-white/80 transition hover:border-white/25"
            >
              {hauntedCrt ? "👻 Haunted CRT" : "✨ Studio CRT"}
            </button>
            <a
              href="#xray-console"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs text-white/75 transition hover:border-[var(--screen-text)] hover:text-white"
            >
              SS7 X-Ray ↓
            </a>
            <a
              href="#kiro-proof"
              className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 font-mono text-xs text-violet-200 transition hover:border-violet-400"
            >
              .kiro/ Proof ↓
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-8 lg:px-8">
        {/* ---- ACT 1: Editorial Hero + Haunted Push-Button Phone Studio ----------- */}
        <section aria-label="Interactive USSD Studio" className="grid items-center gap-10 lg:grid-cols-[1.15fr_400px]">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/65">
                <span className="led-2g inline-block h-2 w-2 rounded-full" />
                <span>2G SS7 Signaling Channel · No Internet Required</span>
              </div>

              <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                When the Internet dies,{" "}
                <span className="font-editorial font-normal italic" style={{ color: "var(--screen-text)" }}>
                  the 2G ghost signal
                </span>{" "}
                survives.
              </h1>

              <p className="max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
                One domain-agnostic Python skeleton (<code className="font-mono text-white/90">core/</code>, strictly under 400 lines)
                powers a <strong className="text-white/90">24/7 Pharmacy</strong>, a{" "}
                <strong className="text-white/90">Zero-Data Food Delivery App</strong>, and more purely from declarative JSON
                manifests — with AI semantic compression and deterministic 160-character GSM-7 fallback.
              </p>
            </div>

            {/* SIM Cartridge Selector & One-Click Scenario Chips */}
            <AppSwitcher
              apps={apps}
              activeApp={app}
              busy={busy}
              onSelect={selectApp}
              onPreset={(inputs) => dial(app, inputs)}
            />

            {/* Compact Live Over-the-Air Signal Summary Strip */}
            {frame && (
              <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="rounded px-2 py-0.5 font-mono text-xs font-bold text-black"
                    style={{ background: "var(--screen-text)" }}
                  >
                    {frame.prefix}
                  </span>
                  <div className="font-mono text-xs">
                    <span className="font-semibold text-white tabular-nums">
                      {frame.char_count} / {frame.max_chars} GSM-7 chars
                    </span>
                    <span className="mx-2 text-white/25">·</span>
                    <span className="text-white/60">
                      mode: <strong className="text-white/85">{frame.telemetry.mode.toUpperCase()}</strong>
                    </span>
                    <span className="mx-2 text-white/25">·</span>
                    <span className="text-white/60">
                      node: <code className="text-white/85">{frame.current_node}</code>
                    </span>
                  </div>
                </div>
                <a
                  href="#xray-console"
                  className="font-mono text-xs font-semibold transition hover:underline"
                  style={{ color: "var(--brand-accent)" }}
                >
                  Open full X-Ray & cURL →
                </a>
              </div>
            )}
          </div>

          {/* Right Column: Pure Haunted Push-Button Feature Phone */}
          <div className="flex flex-col items-center">
            <RetroPhone
              app={app}
              frame={frame}
              busy={busy}
              lastActivity={lastActivity}
              error={requestError}
              idleMessage={idleMessage}
              soundOn={soundOn}
              hauntedCrt={hauntedCrt}
              onDial={dialComposed}
              onSend={send}
              onHangUp={hangUp}
            />
            <div className="mt-3 text-center font-mono text-[11px] text-white/40">
              Tip: type <code className="text-white/70">0-9 * #</code> on your keyboard ·{" "}
              <code className="text-white/70">Enter</code> to send · <code className="text-white/70">Esc</code> to end
            </div>
          </div>
        </section>

        {/* ---- ACT 2: Under the Hood · Live SS7 & Manifest X-Ray Console --------- */}
        <section id="xray-console" aria-label="Engineering X-Ray Console" className="scroll-mt-20 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/45">
                Act II · Telecom & Protocol Verification
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Live SS7 Frame & Manifest X-Ray</h2>
            </div>
            <SkeletonProofBar metrics={metrics} />
          </div>

          <div className="panel rounded-3xl p-4 lg:p-6">
            <div role="tablist" aria-label="Inspection panels" className="mb-5 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-xl border px-3.5 py-2 text-left transition ${
                    tab === t.id
                      ? "border-[var(--screen-text)] bg-black/50"
                      : "border-white/10 bg-black/20 hover:bg-black/35"
                  }`}
                >
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="font-mono text-[10px] text-white/45">{t.hint}</div>
                </button>
              ))}
            </div>

            <div role="tabpanel">
              {tab === "inspector" && <FrameInspector frame={frame} history={history} />}
              {tab === "tree" && (
                <FlowVisualizer app={app} currentNode={frame?.current_node ?? null} path={path} visited={visited} />
              )}
              {tab === "telecom" && <TelecomCurlPanel apps={apps} activeApp={app} />}
            </div>
          </div>
        </section>

        {/* ---- ACT 3: Skeleton Crew & .kiro/ Architecture Bento Proof ------------ */}
        <section id="kiro-proof" aria-label="Skeleton Crew and Kiro Proof" className="scroll-mt-20 space-y-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-violet-300/70">
              Act III · Kiroween 2026 Architecture Proof
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              One <span style={{ color: "var(--screen-text)" }}>&lt; 400 LOC</span> Skeleton. Four Radically Distinct Domains.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Bento 1: Core LOC breakdown */}
            <div className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-white/50">1. Pure Bones (`core/`)</span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300 tabular-nums">
                  {loc} / {maxLoc} LOC
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/60">
                Audited on every file save by <code className="font-mono text-white/85">scripts/check_skeleton_purity.py</code>. Zero
                pharmacy, food, farming, or finance vocabulary exists in <code className="font-mono text-white/85">core/</code>.
              </p>
              <div className="mt-4 space-y-2 font-mono text-xs">
                {Object.entries(metrics?.files ?? {
                  "session_engine.py": 124,
                  "gsm_compressor.py": 74,
                  "models.py": 72,
                  "manifest_loader.py": 65,
                  "webhook_adapter.py": 51,
                })
                  .filter(([, count]) => count > 0)
                  .map(([file, count]) => (
                    <div key={file} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/80">core/{file}</span>
                        <span className="text-white/50 tabular-nums">{count} LOC</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, (count / 140) * 100)}%`, background: "var(--screen-text)" }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Bento 2: 4 Apps Contrast Matrix */}
            <div className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-white/50">2. Declarative Apps (`apps/`)</span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-white/85">
                  {apps.length} SIMs loaded
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/60">
                Every app below is a folder in <code className="font-mono text-white/85">apps/&lt;id&gt;/</code> with{" "}
                <code className="font-mono text-white/85">manifest.json</code>, <code className="font-mono text-white/85">data.json</code>{" "}
                and pure functions in <code className="font-mono text-white/85">handlers.py</code>.
              </p>
              <div className="mt-4 space-y-2">
                {apps.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectApp(item.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left transition hover:border-white/30"
                  >
                    <div className="flex items-center gap-2">
                      <span>{item.theme.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-white">{item.name}</div>
                        <div className="font-mono text-[10px] text-white/45">{item.theme.badgeLabel}</div>
                      </div>
                    </div>
                    <code className="font-mono text-xs font-bold" style={{ color: item.theme.screenText }}>
                      {item.shortcode}
                    </code>
                  </button>
                ))}
              </div>
            </div>

            {/* Bento 3: .kiro/ & Live MCP Prompts for Judges */}
            <div className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-violet-300/80">3. Built with Kiro (`.kiro/`)</span>
                <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-violet-200">
                  Specs · Steering · Hooks · MCP
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/60">
                Try these prompts directly in <strong className="text-white/85">Kiro Chat</strong> via our stdio MCP server (
                <code className="font-mono text-white/85">.kiro/settings/mcp.json</code>):
              </p>
              <div className="mt-3 space-y-2">
                {MCP_PROMPTS.map((prompt, idx) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(prompt);
                      setCopiedPrompt(idx);
                      window.setTimeout(() => setCopiedPrompt((c) => (c === idx ? null : c)), 1400);
                    }}
                    className="group block w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-left font-mono text-[11px] text-white/80 transition hover:border-violet-400/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="line-clamp-2">{prompt}</span>
                      <span className="shrink-0 text-[10px] text-violet-300">
                        {copiedPrompt === idx ? "Copied!" : "Copy"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-4 font-mono text-[11px] text-white/35">
          <span>Kiroween 2026 · Skeleton Crew · EARS specs, steering, PostFileSave hooks and MCP in .kiro/</span>
          <span>No SIM card or API key required: deterministic 160-char GSM-7 fallback by default.</span>
        </footer>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AppSwitcher } from "./components/AppSwitcher";
import { FlowVisualizer } from "./components/FlowVisualizer";
import { FrameInspector } from "./components/FrameInspector";
import { RetroPhone } from "./components/RetroPhone";
import { SkeletonProofBar } from "./components/SkeletonProofBar";
import { TelecomCurlPanel } from "./components/TelecomCurlPanel";
import { fetchApps, fetchMetrics, randomId, sendUssd } from "./lib/api";
import type { HistoryEntry, InputMode, Metrics, UssdApp, UssdFrame } from "./lib/types";

type TabId = "inspector" | "tree" | "telecom";

const TABS: Array<{ id: TabId; label: string; hint: string }> = [
  { id: "inspector", label: "Live Frame Inspector", hint: "CON/END · n/160 · GSM-7 · compression" },
  { id: "tree", label: "Decision Tree", hint: "manifest.json graph" },
  { id: "telecom", label: "Telecom Webhook", hint: "Africa's Talking format" },
];

const DEMO_PHONE = "+237690000000";
const METRICS_POLL_MS = 10_000;

/** Applies the selected app theme to CSS variables used by every component. */
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

function BackendDown({ error }: { error: string }) {
  return (
    <div className="panel mx-auto mt-24 max-w-xl rounded-3xl p-8">
      <h1 className="text-2xl font-bold">Backend unreachable</h1>
      <p className="mt-2 text-white/60">The simulator could not load <code className="font-mono">/api/apps</code> ({error}).</p>
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
  const requestSeq = useRef(0); // ignores late answers after a hang-up or an app switch
  const booted = useRef(false);

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
        setApps(list);
        setActiveId((current) => current || list[0]?.id || "");
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
      setActiveId(target.id);
      setSessionId(sid);
      setFrame(null);
      setHistory([]);
      setVisited([]);
      setIdleMessage(null);
      const label = text ? `${target.shortcode.slice(0, -1)}*${text}#` : target.shortcode;
      void exchange(sid, target.id, text, "cumulative", label);
    },
    [exchange],
  );

  // First paint: dial the first app so a judge sees a live USSD menu immediately.
  useEffect(() => {
    if (booted.current || !apps[0]) return;
    booted.current = true;
    dial(apps[0]);
  }, [apps, dial]);

  /** Accepts *384*1# as well as direct-dial strings such as *384*1*1*1# (shortcode + inputs). */
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
    if (!app || frame?.prefix !== "CON") return;
    void exchange(sessionId, app.id, input, "step", input);
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
  if (!app) return <div className="p-10 font-mono text-white/50">Loading USSD apps...</div>;

  const path = frame ? [...frame.stack, frame.current_node] : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Ghost<span style={{ color: "var(--brand-primary)" }}>Signal</span>
            </h1>
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">USSD-Reborn</span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-white/60">
            One skeleton under 400 lines runs every 2G USSD service below from a JSON manifest. Every screen is a real
            {" "}
            <code className="font-mono">CON</code>/<code className="font-mono">END</code> frame of at most 160 GSM-7 characters.
          </p>
        </div>
        <SkeletonProofBar metrics={metrics} />
      </header>

      <section className="mt-6">
        <AppSwitcher apps={apps} activeId={app.id} onSelect={selectApp} />
      </section>

      <main className="mt-6 grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <RetroPhone
          app={app}
          frame={frame}
          busy={busy}
          lastActivity={lastActivity}
          error={requestError}
          idleMessage={idleMessage}
          onDial={dialComposed}
          onSend={send}
          onHangUp={hangUp}
          onPreset={(inputs) => dial(app, inputs)}
        />

        <section className="panel min-w-0 rounded-3xl p-4 lg:p-5">
          <div role="tablist" aria-label="Inspection panels" className="mb-4 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  tab === t.id ? "border-[var(--brand-primary)] bg-black/40" : "border-white/10 bg-black/15 hover:bg-black/30"
                }`}
              >
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="font-mono text-[10px] text-white/45">{t.hint}</div>
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "inspector" && <FrameInspector frame={frame} history={history} />}
            {tab === "tree" && <FlowVisualizer app={app} currentNode={frame?.current_node ?? null} path={path} visited={visited} />}
            {tab === "telecom" && <TelecomCurlPanel apps={apps} activeApp={app} />}
          </div>
        </section>
      </main>

      <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-white/5 pt-4 font-mono text-[11px] text-white/35">
        <span>Kiroween 2026 · Skeleton Crew · specs, steering, hooks and MCP in .kiro/</span>
        <span>No SIM card, no API key needed: deterministic GSM fallback by default.</span>
      </footer>
    </div>
  );
}

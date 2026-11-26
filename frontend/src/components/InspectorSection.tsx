import { useState } from "react";
import type { HistoryEntry, Metrics, UssdApp, UssdFrame } from "../lib/types";
import { FlowVisualizer } from "./FlowVisualizer";
import { FrameInspector } from "./FrameInspector";
import { Section } from "./Section";
import { SkeletonProofBar } from "./SkeletonProofBar";
import { TelecomCurlPanel } from "./TelecomCurlPanel";

type TabId = "inspector" | "tree" | "telecom";

const TABS: Array<{ id: TabId; label: string; hint: string }> = [
  { id: "inspector", label: "Frame inspector", hint: "raw CON/END, 160-char budget, compression" },
  { id: "tree", label: "Decision tree", hint: "the manifest graph, current node highlighted" },
  { id: "telecom", label: "Africa's Talking", hint: "the exact telecom webhook request + curl" },
];

interface Props {
  app: UssdApp;
  apps: UssdApp[];
  frame: UssdFrame | null;
  history: HistoryEntry[];
  visited: string[];
  metrics: Metrics | null;
}

/** Engineering proof, folded by default so the story stays readable. */
export function InspectorSection({ app, apps, frame, history, visited, metrics }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("inspector");
  const path = frame ? [...frame.stack, frame.current_node] : [];

  return (
    <Section
      id="inspector"
      index="04"
      eyebrow="Under the hood"
      title="Don't trust the ghost. Inspect the frames."
      intro="Every screen on the phone is a real USSD frame. The inspector shows the raw payload, the 160-character budget, the decision graph and the exact request a telecom gateway sends."
    >
      <div className="panel rounded-3xl p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SkeletonProofBar metrics={metrics} />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="rounded-full border border-white/15 px-4 py-2 font-mono text-xs font-semibold text-white/85 transition hover:border-[var(--screen-text)]"
          >
            {open ? "Close the X-Ray ▴" : "Open crypt X-Ray ▾"}
          </button>
        </div>

        {frame && (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-4 font-mono text-xs text-white/55">
            <span>
              Last frame:{" "}
              <span className="rounded px-1.5 py-0.5 font-bold text-black" style={{ background: "var(--screen-text)" }}>
                {frame.prefix}
              </span>
            </span>
            <span className="tabular-nums">
              {frame.char_count} / {frame.max_chars} chars
            </span>
            <span>GSM-7 {frame.gsm7_valid ? "valid" : "INVALID"}</span>
            <span>mode {frame.telemetry.mode}</span>
            <span>node {frame.current_node}</span>
          </div>
        )}

        {open && (
          <div className="mt-6 border-t border-white/10 pt-6">
            <div role="tablist" aria-label="Inspection panels" className="mb-5 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-xl border px-3.5 py-2 text-left transition ${
                    tab === t.id ? "border-[var(--screen-text)] bg-black/50" : "border-white/10 bg-black/20 hover:bg-black/35"
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
          </div>
        )}
      </div>
    </Section>
  );
}
